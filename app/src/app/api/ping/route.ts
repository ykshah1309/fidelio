/**
 * /api/ping — bootstrap smoketest, NOT a product endpoint.
 *
 * Per BUILD_PLAN.md § Tuesday: confirms that
 *   1. the ANTHROPIC_API_KEY env var is set
 *   2. a single Messages API call works end-to-end on Vercel
 *   3. streaming responses are reachable from the browser
 *
 * Delete or replace this once /api/analyze is working on Sunday.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY is not set" },
      { status: 500 },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 32,
      messages: [
        {
          role: "user",
          content:
            "Reply with exactly one word: the word 'pong'. Nothing else.",
        },
      ],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      ok: true,
      model: response.model,
      reply: text.trim(),
      usage: response.usage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
