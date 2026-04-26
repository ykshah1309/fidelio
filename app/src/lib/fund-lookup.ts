/**
 * Typed helper over fund-data.json.
 *
 * Use `lookupFund(ticker)` server-side. Returns null if the fund is not in
 * the curated list — do NOT guess an expense ratio in that case. The analysis
 * prompt tells Claude to say "expense ratio not available" when this returns
 * null; don't subvert that by inventing numbers.
 */

import fundData from "./fund-data.json";
import { FundDataSchema, type FundEntry } from "./types";

// Validate once at module load. If the JSON is malformed this throws on boot,
// which is what we want — better than crashing mid-demo.
const VALIDATED = FundDataSchema.parse(fundData);

export const FUND_DATA_AS_OF = VALIDATED.as_of;
export const FUND_DATA_DISCLAIMER = VALIDATED.disclaimer;

export function lookupFund(ticker: string | null | undefined): FundEntry | null {
  if (!ticker) return null;
  const key = ticker.trim().toUpperCase();
  return VALIDATED.funds[key] ?? null;
}

export function allKnownTickers(): string[] {
  return Object.keys(VALIDATED.funds);
}

/**
 * MCP-style tool definition. When wiring Claude's tool use on Sunday, expose
 * this as `lookup_fund_expense_ratio` — see PROMPTS.md § Tool-use guidance.
 */
export const LOOKUP_FUND_TOOL_DEF = {
  name: "lookup_fund_expense_ratio",
  description:
    "Look up the expense ratio and category for a known 401(k)/brokerage fund by its ticker. Returns null if the fund is not in Fidelio's curated list — in that case, do not estimate. Tell the user the ratio is not available and suggest they check their plan administrator.",
  input_schema: {
    type: "object",
    properties: {
      ticker: {
        type: "string",
        description:
          "Fund ticker symbol, e.g. VTSAX, FXAIX, VTTSX. Case-insensitive.",
      },
    },
    required: ["ticker"],
  },
} as const;

export function runLookupFundTool(input: unknown): unknown {
  const parsed = (input ?? {}) as { ticker?: unknown };
  const ticker = typeof parsed.ticker === "string" ? parsed.ticker : null;
  const entry = lookupFund(ticker);
  if (!entry) {
    return {
      found: false,
      ticker,
      message:
        "This ticker is not in Fidelio's curated fund list. Do not estimate an expense ratio — report 'not available' to the user.",
    };
  }
  return {
    found: true,
    ticker: (ticker as string).toUpperCase(),
    ...entry,
    as_of: FUND_DATA_AS_OF,
  };
}
