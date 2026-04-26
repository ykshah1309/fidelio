/**
 * POST /api/analyze — Upload a PDF, get a Fidelio report via SSE stream.
 *
 * Performance + perception strategy:
 *   1. ONE combined Claude call (extraction + report in a single response).
 *   2. Tool execution parallelized across blocks within a turn.
 *   3. Ephemeral prompt caching on system prompt + the PDF document block.
 *   4. Streaming Claude inference so we can fire the `extraction` event
 *      THE INSTANT </extraction> closes mid-stream — well before the report
 *      finishes generating.
 *   5. Narrator drips human-sounding status beats during the quiet stretches
 *      so the loading screen never looks frozen.
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
  COMBINED_ANALYSIS_PROMPT,
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
import {
  Narrator,
  EXTRACTION_BEATS,
  TOOL_BEATS,
  ANALYSIS_BEATS,
} from "@/lib/narrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ─── Pre-warm MCP bridge at module load ──────────────────────────────────────
if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV !== "test" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  void getFinancialHubBridge().catch(() => {
    /* will retry lazily on first real request */
  });
}

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
      /* stream may be closed */
    }
  }

  function close() {
    try {
      controller.close();
    } catch {
      /* already closed */
    }
  }

  return { stream, send, close };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { stream, send, close } = createSSEStream();

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
  const t0 = Date.now();

  // Narrator drips status beats while the model thinks.
  const narrator = new Narrator((message) =>
    send({ type: "status", message }),
  );

  // ── 1. Read PDF + connect to MCP in parallel ──────────────────────────────

  send({ type: "status", message: "Receiving document…" });

  const MAX_PDF_BYTES = 15 * 1024 * 1024;
  const pdfPromise = (async () => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      throw new Error("No PDF file found in the upload.");
    }
    if (file.size === 0) {
      throw new Error("Uploaded file is empty (0 bytes).");
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(
        `Uploaded PDF is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 15 MB.`,
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    // Sanity-check the magic bytes — every valid PDF starts with "%PDF-"
    const magic = buffer.subarray(0, 5).toString("utf8");
    if (magic !== "%PDF-") {
      throw new Error(
        "That doesn't look like a real PDF. Download a fresh copy directly from your plan provider's site (sometimes browsers save HTML 'preview' pages as .pdf by accident).",
      );
    }
    return {
      pdfBase64: buffer.toString("base64"),
      // Force the canonical PDF media type — Anthropic requires "application/pdf"
      // exactly, and some browsers send "application/octet-stream" or empty.
      mediaType: "application/pdf",
    };
  })();

  const mcpPromise = getFinancialHubBridge().catch((err) => {
    console.error("[Fidelio] MCP bridge failed:", err);
    return null;
  });

  let pdfBase64: string;
  let mediaType: string;
  try {
    const result = await pdfPromise;
    pdfBase64 = result.pdfBase64;
    mediaType = result.mediaType;
  } catch (err) {
    narrator.stop();
    send({
      type: "error",
      message: `Failed to read uploaded file: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  let mcpBridge: MCPBridge | null = null;
  let mcpTools: Array<{ name: string; description: string; input_schema: unknown }> = [];

  try {
    mcpBridge = await mcpPromise;
    if (mcpBridge) {
      mcpTools = await mcpBridge.listTools();
    }
  } catch {
    /* tolerated — local-only mode */
  }

  if (!mcpBridge) {
    send({
      type: "status",
      message: "Live market data unavailable — analyzing with document data only.",
    });
  }

  // ── 2. Tool definitions + cached system blocks ────────────────────────────

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

  type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
  const systemBlocks: SystemBlock[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: TOOL_USE_GUIDANCE,
    },
  ];

  type DocumentBlock = {
    type: "document";
    source: { type: "base64"; media_type: string; data: string };
    cache_control?: { type: "ephemeral" };
  };
  type TextBlock = { type: "text"; text: string };
  type UserContent = DocumentBlock | TextBlock;
  type MessageParam = {
    role: "user" | "assistant";
    content: UserContent[] | unknown;
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
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: COMBINED_ANALYSIS_PROMPT,
        },
      ],
    },
  ];

  // ── 3. Streaming agent loop ───────────────────────────────────────────────

  send({ type: "status", message: "Reading document…" });
  narrator.play(EXTRACTION_BEATS);

  const anthropic = getAnthropic();
  let fullText = "";
  let extractionSent = false;
  let loopCount = 0;
  const MAX_LOOPS = 6;

  while (loopCount < MAX_LOOPS) {
    loopCount++;

    let finalMessage;
    let runningText = "";
    try {
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: 8192,
        system: systemBlocks as unknown as Parameters<typeof anthropic.messages.create>[0]["system"],
        messages: messages as Parameters<typeof anthropic.messages.create>[0]["messages"],
        tools: tools as Parameters<typeof anthropic.messages.create>[0]["tools"],
      });

      // Iterate raw events so we can detect tag closures mid-stream.
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          "delta" in event &&
          event.delta.type === "text_delta"
        ) {
          runningText += event.delta.text;

          // Early-emit the extraction the instant </extraction> closes.
          if (!extractionSent && runningText.includes("</extraction>")) {
            const combinedText = fullText + runningText;
            const rawExtraction = extractTaggedJson<unknown>(combinedText, "extraction");
            if (rawExtraction) {
              extractionSent = true;
              let extraction: Extraction;
              try {
                extraction = ExtractionSchema.parse(rawExtraction);
              } catch {
                extraction = rawExtraction as Extraction;
              }
              send({ type: "extraction", data: extraction });
              // Now that data is extracted, swap the narrator over to
              // analysis-flavored beats so the river stays coherent.
              narrator.shift(ANALYSIS_BEATS);
              send({
                type: "status",
                message: "Translation complete — drafting your report…",
              });
            }
          }
        }
      }

      finalMessage = await stream.finalMessage();
      fullText += runningText;
    } catch (err) {
      narrator.stop();
      send({
        type: "error",
        message: `Claude API error: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    // Tool use blocks (the SDK assembled them for us in finalMessage)
    const toolUseBlocks = finalMessage.content
      .filter((b) => b.type === "tool_use")
      .map((b) => b as unknown as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> });

    if (toolUseBlocks.length === 0) {
      break;
    }

    // Real tool calls are about to fire — swap narrator to tool flavor.
    narrator.shift(TOOL_BEATS);
    if (toolUseBlocks.length === 1) {
      send({ type: "status", message: `Looking up ${toolUseBlocks[0].name}…` });
    } else {
      send({
        type: "status",
        message: `Looking up ${toolUseBlocks.length} fund/data points in parallel…`,
      });
    }

    messages.push({ role: "assistant", content: finalMessage.content });

    // ── Run all tool calls in parallel ──────────────────────────────────
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolBlock) => {
        send({
          type: "tool_call",
          tool: toolBlock.name,
          input: toolBlock.input,
        });

        let toolResult: unknown;
        try {
          if (toolBlock.name === "lookup_fund_expense_ratio") {
            toolResult = runLookupFundTool(toolBlock.input);
          } else if (mcpBridge) {
            toolResult = await mcpBridge.callTool(toolBlock.name, toolBlock.input);
          } else {
            toolResult = {
              error: true,
              message: "Financial data service unavailable. Analyze without this data.",
            };
          }
        } catch (err) {
          toolResult = {
            error: true,
            message: `Tool call failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        send({ type: "tool_result", tool: toolBlock.name, result: toolResult });

        return {
          type: "tool_result" as const,
          tool_use_id: toolBlock.id,
          content: JSON.stringify(toolResult),
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });

    // After tools, Claude moves to the report — line up analysis beats.
    narrator.shift(ANALYSIS_BEATS);
  }

  // ── 4. Parse extraction + report ──────────────────────────────────────────

  // If we didn't catch </extraction> mid-stream (shouldn't happen, but
  // defensive), still emit it now so the UI advances.
  if (!extractionSent) {
    const rawExtraction = extractTaggedJson<unknown>(fullText, "extraction");
    if (rawExtraction) {
      let extraction: Extraction;
      try {
        extraction = ExtractionSchema.parse(rawExtraction);
      } catch {
        extraction = rawExtraction as Extraction;
      }
      send({ type: "extraction", data: extraction });
      extractionSent = true;
    }
  }

  if (!extractionSent) {
    narrator.stop();
    console.error("[Fidelio] No <extraction> tag in Claude response. Length=" + fullText.length);
    console.error("[Fidelio] First 1500 chars of response:\n" + fullText.slice(0, 1500));
    send({ type: "error", message: EXTRACTION_FAILURE_MESSAGE });
    return;
  }

  let report: Report | null = null;
  const rawReport = extractTaggedJson<unknown>(fullText, "report");
  if (rawReport) {
    try {
      report = ReportSchema.parse(rawReport);
    } catch {
      report = rawReport as Report;
    }
  }

  narrator.stop();

  if (report) {
    send({ type: "status", message: "Polishing the final layout…" });
    send({ type: "report", data: report });
    console.log(`[Fidelio] /api/analyze completed in ${Date.now() - t0}ms`);
  } else {
    send({
      type: "error",
      message:
        "Could not generate a structured report from this document. Please try a different PDF.",
    });
  }
}
