"use client";

import type { AnalyzeEvent } from "@/lib/types";

interface LoadingStateProps {
  statusMessage: string;
  events: AnalyzeEvent[];
}

const STEPS = [
  { key: "upload", label: "Uploading document", keywords: ["upload", "loading"] },
  { key: "extract", label: "Reading your document", keywords: ["extracting", "reading", "parsing"] },
  { key: "tools", label: "Looking up fund & market data", keywords: ["fund", "looking", "market", "stock", "economic", "lookup"] },
  { key: "report", label: "Writing your report", keywords: ["writing", "generating", "report", "analysis"] },
];

function getCurrentStep(statusMessage: string, events: AnalyzeEvent[]): number {
  const msg = statusMessage.toLowerCase();
  // Step 3 (tools) if any tool_call events exist
  const hasToolCalls = events.some((e) => e.type === "tool_call");
  if (hasToolCalls) return Math.max(2, getStepFromMessage(msg));
  return getStepFromMessage(msg);
}

function getStepFromMessage(msg: string): number {
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (STEPS[i].keywords.some((kw) => msg.includes(kw))) return i;
  }
  return 0;
}

function humanizeToolCall(event: AnalyzeEvent & { type: "tool_call" }): string {
  const name = event.tool ?? "";
  const input = event.input ?? {};

  if (name === "lookup_fund_expense_ratio") {
    const ticker = (input as { ticker?: string }).ticker;
    return `Looking up ${ticker ?? "fund"} expense ratio…`;
  }
  if (name === "get_stock_quote") {
    const symbol = (input as { symbol?: string }).symbol;
    return `Fetching live price for ${symbol ?? "stock"}…`;
  }
  if (name === "get_economic_data") {
    const indicator = (input as { indicator?: string }).indicator;
    return `Pulling macro data — ${indicator ?? "economic indicator"}…`;
  }
  if (name === "get_company_overview") {
    const symbol = (input as { symbol?: string }).symbol;
    return `Getting overview for ${symbol ?? "company"}…`;
  }
  return `Running tool: ${name}…`;
}

function humanizeToolResult(event: AnalyzeEvent & { type: "tool_result" }): string {
  const name = event.tool ?? "";
  const result = event.result;

  if (name === "lookup_fund_expense_ratio" && result && typeof result === "object") {
    const r = result as { expense_ratio_pct?: number; name?: string };
    if (r.expense_ratio_pct != null) {
      return `Found: ${r.expense_ratio_pct}% expense ratio${r.name ? ` (${r.name})` : ""}`;
    }
  }
  if (name === "get_stock_quote" && result && typeof result === "object") {
    const r = result as { price?: number; symbol?: string };
    if (r.price != null) return `${r.symbol ?? ""}: $${r.price.toFixed(2)}`;
  }
  if (name === "get_economic_data" && result && typeof result === "object") {
    const r = result as { value?: number; series_id?: string };
    if (r.value != null) return `${r.series_id ?? "Value"}: ${r.value}`;
  }
  return "Done";
}

export function LoadingState({ statusMessage, events }: LoadingStateProps) {
  const currentStep = getCurrentStep(statusMessage, events);
  // Progress: each step is 25% — smooth CSS transition handles the animation
  const progressPct = Math.round(((currentStep + 1) / STEPS.length) * 100);

  // Build a human-readable feed from tool events
  const toolFeed = events
    .filter((e) => e.type === "tool_call" || e.type === "tool_result")
    .slice(-8); // show last 8 events

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        {/* Animated ring */}
        <div className="relative mx-auto h-14 w-14 mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-border/30" />
          <div className="absolute inset-0 rounded-full border-2 border-t-amber-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-amber-500/60 animate-pulse" />
          </div>
        </div>

        {/* Smooth progress bar */}
        <div className="relative h-1 w-full rounded-full bg-border/50 overflow-hidden mb-8">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="space-y-3 mb-8">
          {STEPS.map((step, i) => {
            const isDone = i < currentStep;
            const isActive = i === currentStep;
            return (
              <div key={step.key} className="flex items-center gap-3">
                {/* Indicator dot */}
                <div className="shrink-0 flex items-center justify-center h-5 w-5">
                  {isDone ? (
                    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : isActive ? (
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-border" />
                  )}
                </div>
                <span
                  className={
                    isDone
                      ? "text-sm text-muted-foreground line-through"
                      : isActive
                        ? "text-sm text-foreground font-medium"
                        : "text-sm text-muted-foreground/40"
                  }
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Live tool feed */}
        {toolFeed.length > 0 && (
          <div className="rounded-lg border border-border/30 bg-card/30 px-4 py-3 space-y-1.5">
            <p className="text-xs text-muted-foreground/60 font-medium uppercase tracking-wider mb-2">
              Live data lookups
            </p>
            {toolFeed.map((event, i) => {
              if (event.type === "tool_call") {
                return (
                  <div key={i} className="flex items-start gap-2 text-xs font-mono">
                    <span className="text-amber-400 shrink-0">→</span>
                    <span className="text-muted-foreground">
                      {humanizeToolCall(event as AnalyzeEvent & { type: "tool_call" })}
                    </span>
                  </div>
                );
              }
              if (event.type === "tool_result") {
                return (
                  <div key={i} className="flex items-start gap-2 text-xs font-mono">
                    <span className="text-emerald-400 shrink-0">←</span>
                    <span className="text-emerald-400/80">
                      {humanizeToolResult(event as AnalyzeEvent & { type: "tool_result" })}
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          {statusMessage}
        </p>
      </div>
    </main>
  );
}
