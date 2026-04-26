/**
 * Fidelio type definitions.
 *
 * Mirrors the JSON schemas in Fidelio/PROMPTS.md exactly. If you change a
 * schema in PROMPTS.md, change it here too — and vice versa.
 *
 * The Zod schemas below are exported so API routes can validate Claude's JSON
 * output before passing it to the frontend. Do not skip validation — the
 * moment an unvalidated field lands in a React component, you get render
 * crashes on stage.
 */

import { z } from "zod";

// ─── Document extraction ─────────────────────────────────────────────────────

export const DocumentTypeSchema = z.enum([
  "401k_statement",
  "403b_statement",
  "ira_statement",
  "brokerage_statement",
  "paystub",
  "other",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const HoldingCategorySchema = z.enum([
  "target_date",
  "equity_index",
  "bond_index",
  "active_equity",
  "active_bond",
  "money_market",
  "company_stock",
  "other",
]);
export type HoldingCategory = z.infer<typeof HoldingCategorySchema>;

export const HoldingSchema = z.object({
  name: z.string(),
  ticker: z.string().nullable(),
  balance_usd: z.number().nullable(),
  shares: z.number().nullable(),
  allocation_pct: z.number().nullable(),
  expense_ratio_pct: z.number().nullable(),
  category: HoldingCategorySchema.nullable(),
});
export type Holding = z.infer<typeof HoldingSchema>;

export const DeductionTypeSchema = z.enum([
  "federal_tax",
  "state_tax",
  "fica",
  "medicare",
  "retirement",
  "health_insurance",
  "dental",
  "vision",
  "hsa",
  "fsa",
  "other",
]);

export const PayFrequencySchema = z.enum([
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
]);

export const PaystubSchema = z
  .object({
    gross_pay: z.number().nullable(),
    net_pay: z.number().nullable(),
    pay_frequency: PayFrequencySchema.nullable(),
    deductions: z.array(
      z.object({
        name: z.string(),
        amount: z.number(),
        type: DeductionTypeSchema,
      }),
    ),
    retirement_contribution: z
      .object({
        amount_per_period: z.number(),
        pct_of_gross: z.number().nullable(),
      })
      .nullable(),
    employer_match: z
      .object({
        amount_per_period: z.number().nullable(),
        match_rate_pct: z.number().nullable(),
        cap_pct: z.number().nullable(),
      })
      .nullable(),
    ytd_gross: z.number().nullable(),
    ytd_net: z.number().nullable(),
  })
  .nullable();

export const ExtractionSchema = z.object({
  document_type: DocumentTypeSchema,
  period: z.object({
    start: z.string().nullable(),
    end: z.string().nullable(),
  }),
  provider: z.string().nullable(),
  account_type: z.string().nullable(),
  total_balance: z.number().nullable(),
  ytd_contributions: z
    .object({
      employee: z.number().nullable(),
      employer: z.number().nullable(),
    })
    .nullable(),
  holdings: z.array(HoldingSchema),
  paystub: PaystubSchema,
  raw_notes: z.array(z.string()),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

// ─── Report (user-facing) ────────────────────────────────────────────────────

export const SeveritySchema = z.enum(["info", "warning", "critical"]);
export const VerdictSchema = z.enum(["good", "okay", "expensive", "unknown"]);
export const EffortSchema = z.enum([
  "5_minutes",
  "30_minutes",
  "this_week",
]);

export const HeadlineSchema = z.object({
  one_line: z.string(),
  dollar_amount: z.number(),
  severity: SeveritySchema,
});

export const HoldingsReviewItemSchema = z.object({
  name: z.string(),
  ticker: z.string().nullable(),
  balance_usd: z.number().nullable(),
  allocation_pct: z.number().nullable(),
  expense_ratio_pct: z.number().nullable(),
  plain_english: z.string(),
  verdict: VerdictSchema,
  verdict_reason: z.string(),
});

export const FeeImpactSchema = z
  .object({
    annual_fees_usd: z.number().nullable(),
    ten_year_cost_usd: z.number().nullable(),
    twenty_year_cost_usd: z.number().nullable(),
    thirty_year_cost_usd: z.number().nullable(),
    assumptions: z.string(),
    explanation: z.string(),
  })
  .nullable();

export const MatchAnalysisSchema = z
  .object({
    current_contribution_pct: z.number().nullable(),
    employer_match_rate_pct: z.number().nullable(),
    employer_match_cap_pct: z.number().nullable(),
    money_left_on_table_annual_usd: z.number().nullable(),
    plain_english: z.string(),
  })
  .nullable();

export const PaystubNotesSchema = z
  .object({
    withholding_check: z.string(),
    retirement_note: z.string().nullable(),
    flags: z.array(z.string()),
  })
  .nullable();

export const ActionItemSchema = z.object({
  title: z.string(),
  detail: z.string(),
  effort: EffortSchema,
  impact_usd_annual: z.number().nullable(),
});

export const ReportSchema = z.object({
  headline: HeadlineSchema,
  holdings_review: z.array(HoldingsReviewItemSchema),
  fee_impact: FeeImpactSchema,
  match_analysis: MatchAnalysisSchema,
  paystub_notes: PaystubNotesSchema,
  action_items: z.array(ActionItemSchema).length(3),
  disclaimer: z.string(),
});
export type Report = z.infer<typeof ReportSchema>;

// ─── Fund-data lookup ────────────────────────────────────────────────────────

export const FundCategorySchema = z.enum([
  "equity_index",
  "bond_index",
  "target_date_index",
  "target_date_active",
  "active_equity",
  "active_bond",
  "money_market",
  "other",
]);
export type FundCategory = z.infer<typeof FundCategorySchema>;

export const FundEntrySchema = z.object({
  name: z.string(),
  issuer: z.string(),
  expense_ratio_pct: z.number(),
  category: FundCategorySchema,
  plain_english: z.string(),
});
export type FundEntry = z.infer<typeof FundEntrySchema>;

export const FundDataSchema = z.object({
  as_of: z.string(),
  disclaimer: z.string(),
  funds: z.record(z.string(), FundEntrySchema),
});
export type FundData = z.infer<typeof FundDataSchema>;

// ─── Streaming events (SSE to the frontend) ──────────────────────────────────

export type AnalyzeEvent =
  | { type: "status"; message: string }
  | { type: "extraction"; data: Extraction }
  | { type: "tool_call"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "report"; data: Report }
  | { type: "error"; message: string }
  | { type: "done" };
