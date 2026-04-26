/**
 * POST /api/analyze — Upload a PDF, get a Fidelio report via SSE stream.
 *
 * Flow:
 *   1. Accept multipart/form-data with a PDF file.
 *   2. Send the PDF to Claude with the system + extraction prompt.
 *   3. Handle tool use loop (MCP tools + local fund lookup).
 *   4. Parse <extraction> and <report> tags from Claude's response.
 *   5. Stream AnalyzeEvent objects to the frontend via SSE.
 *
 * If MCP bridge fails to connect, we still run — Claude can do the
 * extraction without external tools, just with degraded data.
 */

import { NextRequest } from "next/server";
import { getAnthropic, MODEL, extractTaggedJson } from "@/lib/claude";
import { getFinancialHubBridge, type MCPBridge } from "@/lib/mcp";
import {
  LOOKUP_FUND_TOOL_DEF,
  runLookupFundTool,
} from "@/lib/fund-lookup";
import {
  SYSTEM_PROMPT,
  EXTRACTION_PROMPT,
  ANALYSIS_PROMPT,
  TOOL_USE_GUIDANCE,
  EXTRACTION_FAILURE_MESSAGE,
} from "@/lib/prompts";
import {
  ExtractionSchema,
  ReportSchema,
  type AnalyzeEvent,
  type Extraction,
  type Report,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // Vercel pro plan

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseEncode(event: AnalyzeEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  function send(event: AnalyzeEvent) {
    try {
      controller.enqueue(encoder.encode(sseEncode(event)));
    } catch {
      // stream may be closed
    }
  }

  function close() {
    try {
      controller.close();
    } catch {
      // already closed
    }
  }

  return { stream, send, close };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { stream, send, close } = createSSEStream();

  // Start async processing
  processAnalysis(request, send).finally(() => {
    send({ type: "done" });
    close();
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function processAnalysis(
  request: NextRequest,
  send: (event: AnalyzeEvent) => void,
) {
  // ── 1. Parse the uploaded PDF ──────────────────────────────────────────────

  send({ type: "status", message: "Receiving document…" });

  let pdfBase64: string;
  let mediaType: string;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      send({ type: "error", message: "No PDF file found in the upload." });
      return;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    pdfBase64 = buffer.toString("base64");
    mediaType = file.type || "application/pdf";
  } catch (err) {
    send({
      type: "error",
      message: `Failed to read uploaded file: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  // ── 2. Connect to MCP (non-blocking — degrade gracefully) ─────────────────

  send({ type: "status", message: "Connecting to financial data…" });

  let mcpBridge: MCPBridge | null = null;
  let mcpTools: Array<{ name: string; description: string; input_schema: unknown }> = [];

  try {
    mcpBridge = await getFinancialHubBridge();
    mcpTools = await mcpBridge.listTools();
  } catch (err) {
    console.error("[Fidelio] MCP bridge failed to connect:", err);
    send({
      type: "status",
      message: "Live market data unavailable — analyzing with document data only.",
    });
  }

  // ── 3. Build tool definitions for Claude ───────────────────────────────────

  const tools = [
    ...mcpTools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Record<string, unknown>,
    })),
    {
      name: LOOKUP_FUND_TOOL_DEF.name,
      description: LOOKUP_FUND_TOOL_DEF.description,
      input_schema: LOOKUP_FUND_TOOL_DEF.input_schema as unknown as Record<string, unknown>,
    },
  ];

  // ── 4. Initial Claude call — extraction ────────────────────────────────────

  send({ type: "status", message: "Reading document…" });

  const anthropic = getAnthropic();
  const systemPrompt = `${SYSTEM_PROMPT}\n\n${TOOL_USE_GUIDANCE}`;

  type MessageParam = {
    role: "user" | "assistant";
    content: unknown;
  };

  const messages: MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: mediaType,
            data: pdfBase64,
          },
        },
        {
          type: "text",
          text: EXTRACTION_PROMPT,
        },
      ],
    },
  ];

  // ── 5. Agent loop — handle tool use ────────────────────────────────────────

  let fullText = "";
  let loopCount = 0;
  const MAX_LOOPS = 10;

  while (loopCount < MAX_LOOPS) {
    loopCount++;

    let response;
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        messages: messages as Parameters<typeof anthropic.messages.create>[0]["messages"],
        tools: tools as Parameters<typeof anthropic.messages.create>[0]["tools"],
      });
    } catch (err) {
      send({
        type: "error",
        message: `Claude API error: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    // Collect text from this response
    const responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? (b as { text: string }).text : ""))
      .join("");
    fullText += responseText;

    // Handle tool use blocks
    const toolUseBlocks = response.content
      .filter((b) => b.type === "tool_use")
      .map((b) => b as unknown as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> });

    if (toolUseBlocks.length > 0) {
      // Add assistant's response to messages
      messages.push({
        role: "assistant",
        content: response.content,
      });

      // Execute each tool call
      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];

      for (const toolBlock of toolUseBlocks) {
        send({
          type: "tool_call",
          tool: toolBlock.name,
          input: toolBlock.input,
        });

        let toolResult: unknown;

        if (toolBlock.name === "lookup_fund_expense_ratio") {
          // Local tool
          send({ type: "status", message: `Looking up fund data for ${(toolBlock.input as Record<string,string>).ticker ?? "unknown"}…` });
          toolResult = runLookupFundTool(toolBlock.input);
        } else if (mcpBridge) {
          // MCP tool
          const friendlyNames: Record<string, string> = {
            get_stock_quote: "Fetching live quote",
            get_company_overview: "Looking up company details",
            get_economic_data: "Checking economic indicators",
            search_companies: "Searching company records",
          };
          send({
            type: "status",
            message: `${friendlyNames[toolBlock.name] ?? toolBlock.name}…`,
          });

          try {
            toolResult = await mcpBridge.callTool(toolBlock.name, toolBlock.input);
          } catch (err) {
            toolResult = {
              error: true,
              message: `Tool call failed: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        } else {
          toolResult = {
            error: true,
            message: "Financial data service unavailable. Analyze without this data.",
          };
        }

        send({
          type: "tool_result",
          tool: toolBlock.name,
          result: toolResult,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Add tool results to messages
      messages.push({
        role: "user",
        content: toolResults,
      });

      // Continue the loop — Claude needs to process tool results
      continue;
    }

    // No tool use — Claude finished this turn
    if (response.stop_reason === "end_turn") {
      break;
    }

    break;
  }

  // ── 6. Parse extraction ────────────────────────────────────────────────────

  send({ type: "status", message: "Processing extracted data…" });

  const rawExtraction = extractTaggedJson<unknown>(fullText, "extraction");
  if (!rawExtraction) {
    send({ type: "error", message: EXTRACTION_FAILURE_MESSAGE });
    return;
  }

  let extraction: Extraction;
  try {
    extraction = ExtractionSchema.parse(rawExtraction);
  } catch {
    // Soft-parse: try to use what we got even if Zod is strict
    extraction = rawExtraction as Extraction;
  }

  send({ type: "extraction", data: extraction });

  // ── 7. Check if report is already in the response ──────────────────────────

  let report: Report | null = null;
  const rawReport = extractTaggedJson<unknown>(fullText, "report");
  if (rawReport) {
    try {
      report = ReportSchema.parse(rawReport);
    } catch {
      report = rawReport as Report;
    }
  }

  // ── 8. If no report yet, ask Claude for the analysis ───────────────────────

  if (!report) {
    send({ type: "status", message: "Writing your report…" });

    messages.push({
      role: "user",
      content: ANALYSIS_PROMPT,
    });

    // Second agent loop for analysis
    let analysisText = "";
    let analysisLoops = 0;

    while (analysisLoops < MAX_LOOPS) {
      analysisLoops++;

      let response;
      try {
        response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 8192,
          system: systemPrompt,
          messages: messages as Parameters<typeof anthropic.messages.create>[0]["messages"],
          tools: tools as Parameters<typeof anthropic.messages.create>[0]["tools"],
        });
      } catch (err) {
        send({
          type: "error",
          message: `Claude API error during analysis: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }

      const analysisTextParts = response.content
        .filter((b) => b.type === "text")
        .map((b) => ("text" in b ? (b as { text: string }).text : ""));
      analysisText += analysisTextParts.join("");

      const toolUseBlocks = response.content
        .filter((b) => b.type === "tool_use")
        .map((b) => b as unknown as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> });

      if (toolUseBlocks.length > 0) {
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Array<{
          type: "tool_result";
          tool_use_id: string;
          content: string;
        }> = [];

        for (const toolBlock of toolUseBlocks) {
          send({
            type: "tool_call",
            tool: toolBlock.name,
            input: toolBlock.input,
          });

          let toolResult: unknown;
          if (toolBlock.name === "lookup_fund_expense_ratio") {
            toolResult = runLookupFundTool(toolBlock.input);
          } else if (mcpBridge) {
            try {
              toolResult = await mcpBridge.callTool(toolBlock.name, toolBlock.input);
            } catch (err) {
              toolResult = {
                error: true,
                message: `Tool call failed: ${err instanceof Error ? err.message : String(err)}`,
              };
            }
          } else {
            toolResult = { error: true, message: "Financial data service unavailable." };
          }

          send({ type: "tool_result", tool: toolBlock.name, result: toolResult });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: JSON.stringify(toolResult),
          });
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      break;
    }

    const rawAnalysisReport = extractTaggedJson<unknown>(analysisText, "report");
    if (rawAnalysisReport) {
      try {
        report = ReportSchema.parse(rawAnalysisReport);
      } catch {
        report = rawAnalysisReport as Report;
      }
    }
  }

  // ── 9. Send the final report ───────────────────────────────────────────────

  if (report) {
    send({ type: "report", data: report });
  } else {
    send({
      type: "error",
      message: "Could not generate a structured report from this document. Please try a different PDF.",
    });
  }
}
