/**
 * Anthropic SDK client — lazy singleton.
 *
 * Usage:
 *   import { getAnthropic, MODEL } from "@/lib/claude";
 *   const client = getAnthropic();
 *   const msg = await client.messages.create({ model: MODEL, ... });
 *
 * Do not instantiate `new Anthropic(...)` directly in API routes — you lose
 * the env-var check and get confusing runtime errors on missing keys.
 */

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
export const CHEAP_MODEL = process.env.ANTHROPIC_FREE_MODEL ?? "claude-haiku-4-5-20251001";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Small helper: given a Claude Messages response, extract the concatenated
 * text content. Ignores tool_use blocks.
 */
export function messageText(response: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return response.content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("");
}

/**
 * Extract the JSON payload from within <extraction>...</extraction> or
 * <report>...</report> tags. Returns null if the tag is missing or the JSON
 * is malformed — never throws.
 */
export function extractTaggedJson<T = unknown>(
  text: string,
  tag: "extraction" | "report",
): T | null {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim()) as T;
  } catch {
    return null;
  }
}
