/**
 * POST /api/chat — Follow-up questions on the results page.
 *
 * Expects JSON body:
 *   {
 *     extraction: Extraction,     // from the analysis phase
 *     report: Report,             // from the analysis phase
 *     messages: ChatMessage[],    // conversation history
 *     question: string            // the new user question
 *   }
 *
 * Returns a streaming text response (plain text, not SSE).
 */

import { NextRequest } from "next/server";
import { getAnthropic, MODEL } from "@/lib/claude";
import { getFinancialHubBridge } from "@/lib/mcp";
import { LOOKUP_FUND_TOOL_DEF, runLookupFundTool } from "@/lib/fund-lookup";
import { SYSTEM_PROMPT, CHAT_PRIMER_PROMPT, TOOL_USE_GUIDANCE } from "@/lib/prompts";
import type { Extraction, Report } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatRequest {
  extraction: Extraction;
  report: Report;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  question: string;
}

export async function POST(request: NextRequest) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { extraction, report, messages: history, question } = body;

  if (!question?.trim()) {
    return new Response(JSON.stringify({ error: "No question provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const anthropic = getAnthropic();

  // Build system prompt with context
  const systemPrompt = [
    SYSTEM_PROMPT,
    TOOL_USE_GUIDANCE,
    CHAT_PRIMER_PROMPT,
    `\n<context>\nHere is the extracted data from the user's document:\n${JSON.stringify(extraction, null, 2)}\n\nHere is the report that was generated:\n${JSON.stringify(report, null, 2)}\n</context>`,
  ].join("\n\n");

  // Build tools
  let tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }> = [
    {
      name: LOOKUP_FUND_TOOL_DEF.name,
      description: LOOKUP_FUND_TOOL_DEF.description,
      input_schema: LOOKUP_FUND_TOOL_DEF.input_schema as unknown as Record<string, unknown>,
    },
  ];

  try {
    const bridge = await getFinancialHubBridge();
    const mcpTools = await bridge.listTools();
    tools = [
      ...mcpTools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Record<string, unknown>,
      })),
      ...tools,
    ];
  } catch {
    // MCP unavailable — proceed with local tools only
  }

  // Build message history
  type MessageParam = { role: "user" | "assistant"; content: unknown };
  const conversationMessages: MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: question },
  ];

  // Agent loop for chat (handles tool calls)
  let loopCount = 0;
  const MAX_LOOPS = 5;
  let finalText = "";

  while (loopCount < MAX_LOOPS) {
    loopCount++;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: conversationMessages as Parameters<typeof anthropic.messages.create>[0]["messages"],
      tools: tools as Parameters<typeof anthropic.messages.create>[0]["tools"],
    });

    finalText = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? (b as { text: string }).text : ""))
      .join("");

    const toolUseBlocks = response.content
      .filter((b) => b.type === "tool_use")
      .map((b) => b as unknown as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> });

    if (toolUseBlocks.length > 0) {
      conversationMessages.push({
        role: "assistant",
        content: response.content,
      });

      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];

      for (const toolBlock of toolUseBlocks) {
        let toolResult: unknown;
        if (toolBlock.name === "lookup_fund_expense_ratio") {
          toolResult = runLookupFundTool(toolBlock.input);
        } else {
          try {
            const bridge = await getFinancialHubBridge();
            toolResult = await bridge.callTool(toolBlock.name, toolBlock.input);
          } catch (err) {
            toolResult = {
              error: true,
              message: `Tool unavailable: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: JSON.stringify(toolResult),
        });
      }

      conversationMessages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return new Response(JSON.stringify({ reply: finalText }), {
    headers: { "Content-Type": "application/json" },
  });
}
