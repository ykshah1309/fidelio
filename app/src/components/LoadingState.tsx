"use client";

import type { AnalyzeEvent } from "@/lib/types";

interface LoadingStateProps {
  statusMessage: string;
  events: AnalyzeEvent[];
}

const STEPS = [
  {
    key: "upload",
    label: "Uploading document",
    code: "01",
    keywords: ["upload", "loading", "receiving"],
  },
  {
    key: "extract",
    label: "Reading your document",
    code: "02",
    keywords: [
      "extracting", "reading", "parsing", "scanning", "identifying",
      "cataloging", "spotting", "pulling employer", "balances", "structure",
    ],
  },
  {
    key: "tools",
    label: "Looking up fund & market data",
    code: "03",
    keywords: [
      "fund", "looking", "market", "stock", "economic", "lookup",
      "cross-reference", "tickers", "benchmark", "database", "filings",
      "expense ratios", "live", "verifying",
    ],
  },
  {
    key: "report",
    label: "Writing your report",
    code: "04",
    keywords: [
      "writing", "generating", "report", "analysis", "drafting", "polishing",
      "finalizing", "computing", "compounding", "comparing", "quantifying",
      "ranking", "translation complete", "headline",
    ],
  },
];

function getCurrentStep(statusMessage: string, events: AnalyzeEvent[]): number {
  const msg = statusMessage.toLowerCase();
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
    return `lookup_fund_expense_ratio ${ticker ?? "fund"}`;
  }
  if (name === "get_stock_quote") {
    const symbol = (input as { symbol?: string }).symbol;
    return `get_stock_quote ${symbol ?? "stock"}`;
  }
  if (name === "get_economic_data") {
    const indicator = (input as { indicator?: string }).indicator;
    return `get_economic_data ${indicator ?? "indicator"}`;
  }
  if (name === "get_company_overview") {
    const symbol = (input as { symbol?: string }).symbol;
    return `get_company_overview ${symbol ?? "company"}`;
  }
  return `${name}`;
}

function humanizeToolResult(event: AnalyzeEvent & { type: "tool_result" }): string {
  const name = event.tool ?? "";
  const result = event.result;

  if (name === "lookup_fund_expense_ratio" && result && typeof result === "object") {
    const r = result as { expense_ratio_pct?: number; name?: string };
    if (r.expense_ratio_pct != null) {
      return `→ ${r.expense_ratio_pct}% ER${r.name ? ` · ${r.name}` : ""}`;
    }
  }
  if (name === "get_stock_quote" && result && typeof result === "object") {
    const r = result as { price?: number; symbol?: string };
    if (r.price != null) return `→ ${r.symbol ?? ""} $${r.price.toFixed(2)}`;
  }
  if (name === "get_economic_data" && result && typeof result === "object") {
    const r = result as { value?: number; series_id?: string };
    if (r.value != null) return `→ ${r.series_id ?? "Value"} ${r.value}`;
  }
  return "→ ok";
}

export function LoadingState({ statusMessage, events }: LoadingStateProps) {
  const currentStep = getCurrentStep(statusMessage, events);
  const progressPct = Math.round(((currentStep + 1) / STEPS.length) * 100);
  const toolFeed = events
    .filter((e) => e.type === "tool_call" || e.type === "tool_result")
    .slice(-10);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gold/5 blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Editorial nameplate */}
        <div className="text-center mb-8">
          <span className="font-mono text-[10px] uppercase tracking-widest text-gold">
            Fidelio · Live Analysis
          </span>
          <h1 className="mt-2 font-serif text-2xl font-bold tracking-editorial text-foreground">
            Reading your document.
          </h1>
        </div>

        {/* Progress bar */}
        <div className="relative h-[3px] w-full rounded-full bg-border/60 overflow-hidden mb-8">
          <div
            className="h-full rounded-full bg-gold transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute top-0 h-full w-12 bg-gradient-to-r from-transparent via-gold-soft/50 to-transparent"
            style={{
              left: `${Math.max(0, progressPct - 8)}%`,
              transition: "left 0.7s ease-out",
            }}
          />
        </div>

        {/* Step indicators — editorial numerals */}
        <div className="space-y-3 mb-8">
          {STEPS.map((step, i) => {
            const isDone = i < currentStep;
            const isActive = i === currentStep;
            return (
              <div
                key={step.key}
                className={`flex items-center gap-4 rounded-md px-3 py-2 transition-colors ${
                  isActive ? "bg-gold/5 border border-gold/20" : ""
                }`}
              >
                <span
                  className={`font-mono text-[10px] tracking-widest w-6 ${
                    isDone ? "text-forest" : isActive ? "text-gold" : "text-muted-foreground/30"
                  }`}
                >
                  {isDone ? "✓" : step.code}
                </span>
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
                {isActive && (
                  <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {/* Terminal-style live tool feed */}
        <div className="relative rounded-lg border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
          {/* Terminal header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-oxblood/80" />
              <span className="h-2 w-2 rounded-full bg-gold/80" />
              <span className="h-2 w-2 rounded-full bg-forest/80" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              MCP · live data
            </span>
          </div>

          {/* Scanning line */}
          <div className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-gold/10 to-transparent animate-scan"
            />

            {/* Feed */}
            <div className="px-4 py-3 space-y-1 min-h-[160px] font-mono text-[11px]">
              {toolFeed.length === 0 && (
                <div className="text-muted-foreground/50">
                  <span className="text-gold">$</span> awaiting data
                  <span className="animate-blink text-gold">▍</span>
                </div>
              )}
              {toolFeed.map((event, i) => {
                if (event.type === "tool_call") {
                  return (
                    <div key={i} className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-gold shrink-0">$</span>
                      <span>
                        {humanizeToolCall(event as AnalyzeEvent & { type: "tool_call" })}
                      </span>
                    </div>
                  );
                }
                if (event.type === "tool_result") {
                  return (
                    <div key={i} className="flex items-start gap-2 text-forest pl-4">
                      <span>
                        {humanizeToolResult(event as AnalyzeEvent & { type: "tool_result" })}
                      </span>
                    </div>
                  );
                }
                return null;
              })}
              {/* Cursor */}
              <div className="flex items-center gap-2 text-muted-foreground/60">
                <span className="text-gold shrink-0">$</span>
                <span className="animate-blink text-gold">▍</span>
              </div>
            </div>
          </div>
        </div>

        {/* Keyed wrapper so each new status beat slides into place — gives
            the rapid narrator drips a calm, deliberate cadence instead of
            a flickering flash. */}
        <p
          key={statusMessage}
          className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 animate-fade-in-up"
        >
          {statusMessage}
        </p>
      </div>
    </main>
  );
}
