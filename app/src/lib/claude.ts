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
 *
 * Robust to common Claude quirks:
 *   - JSON wrapped in a ```json ... ``` fence inside the tag
 *   - Leading/trailing prose inside the tag ("Here's the JSON: { ... }")
 *   - Missing tags entirely (last-resort scan for a JSON object containing
 *     a tag-specific anchor field).
 */
export function extractTaggedJson<T = unknown>(
  text: string,
  tag: "extraction" | "report",
): T | null {
  // Pass 1 — properly tagged
  const tagged = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  if (tagged) {
    const cleaned = stripFencesAndProse(tagged[1]);
    const parsed = tryParseJson(cleaned);
    if (parsed !== null) return parsed as T;
    // If the tagged JSON is malformed, fall through to anchor-based recovery.
  }

  // Pass 2 — last-resort: find the first JSON object whose top-level keys
  // include a tag-specific anchor. This rescues responses where Claude
  // forgot the tags but still emitted valid JSON.
  const anchor = tag === "extraction" ? "document_type" : "headline";
  const anchored = findJsonObjectContainingKey(text, anchor);
  if (anchored !== null) return anchored as T;

  return null;
}

function stripFencesAndProse(s: string): string {
  let out = s.trim();
  // ```json ... ```  or ``` ... ```
  const fenced = out.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/);
  if (fenced) out = fenced[1].trim();
  // If there's leading prose, trim to the first { and trailing } block.
  const firstBrace = out.indexOf("{");
  const lastBrace = out.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    out = out.slice(firstBrace, lastBrace + 1);
  }
  return out;
}

function tryParseJson(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Scan text for a top-level JSON object whose keys include `key`. */
function findJsonObjectContainingKey(text: string, key: string): unknown | null {
  // Find every `{` and try to match braces, then test if the parsed object
  // has the anchor key. Cheap enough for our payload sizes.
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(i, j + 1);
          const parsed = tryParseJson(candidate);
          if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed) &&
            key in (parsed as Record<string, unknown>)
          ) {
            return parsed;
          }
          break; // try next `{`
        }
      }
    }
  }
  return null;
}
