"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";
import { formatUSD, formatPct, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FinanceTerm } from "@/components/ui/FinanceTerm";

interface HoldingsTableProps {
  holdings: Report["holdings_review"];
}

const verdictConfig = {
  good: { color: "bg-forest/15 text-forest border-forest/40", label: "Low cost" },
  okay: { color: "bg-gold/15 text-gold border-gold/40", label: "Reasonable" },
  expensive: { color: "bg-oxblood/15 text-oxblood border-oxblood/40", label: "Expensive" },
  unknown: { color: "bg-muted text-muted-foreground border-border", label: "Unknown" },
};

const allocationBarColor: Record<string, string> = {
  good: "bg-forest",
  okay: "bg-gold",
  expensive: "bg-oxblood",
  unknown: "bg-muted-foreground",
};

// ER dot on scale 0–1.5%
function ERDot({ er, verdict }: { er: number; verdict: string }) {
  const clampedPct = Math.min(100, (er / 1.5) * 100);
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="relative h-1 flex-1 rounded-full bg-foreground/10">
        {/* Benchmark marker at 0.10% */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2.5 w-px bg-forest/60"
          style={{ left: `${(0.1 / 1.5) * 100}%` }}
          title="0.10% — index fund benchmark"
        />
        {/* ER position dot */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full -ml-1",
            verdict === "expensive" ? "bg-oxblood" : verdict === "good" ? "bg-forest" : "bg-gold",
          )}
          style={{ left: `${clampedPct}%` }}
          title={`${er}% expense ratio`}
        />
      </div>
      <span className={cn(
        "text-xs font-mono shrink-0 nums",
        verdict === "expensive" ? "text-oxblood" : "text-muted-foreground",
      )}>
        {formatPct(er)} ER
      </span>
    </div>
  );
}

type SortKey = "default" | "balance" | "expense_ratio" | "allocation";
type SortDir = "asc" | "desc";

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (!holdings || holdings.length === 0) return null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...holdings].sort((a, b) => {
    if (sortKey === "default") return 0;
    const aVal = sortKey === "balance" ? (a.balance_usd ?? -1) : sortKey === "expense_ratio" ? (a.expense_ratio_pct ?? -1) : (a.allocation_pct ?? -1);
    const bVal = sortKey === "balance" ? (b.balance_usd ?? -1) : sortKey === "expense_ratio" ? (b.expense_ratio_pct ?? -1) : (b.allocation_pct ?? -1);
    return sortDir === "desc" ? bVal - aVal : aVal - bVal;
  });

  function SortButton({ k, label }: { k: SortKey; label: string }) {
    const isActive = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded transition-colors",
          isActive
            ? "text-gold bg-gold/10"
            : "text-muted-foreground/60 hover:text-muted-foreground",
        )}
      >
        {label} {isActive ? (sortDir === "desc" ? "↓" : "↑") : ""}
      </button>
    );
  }

  return (
    <div id="holdings" className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
      <div className="px-7 py-5 border-b border-border/50 flex items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            II · Holdings Review
          </span>
          <h2 className="font-serif text-2xl font-bold tracking-editorial text-foreground mt-0.5">What You Own</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Every fund in your account, explained in plain English.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mr-1">Sort</span>
          <SortButton k="balance" label="Balance" />
          <SortButton k="expense_ratio" label="ER" />
          <SortButton k="allocation" label="%" />
        </div>
      </div>

      <div className="divide-y divide-border/30">
        {sorted.map((holding, i) => {
          const config = verdictConfig[holding.verdict];
          const allocPct = holding.allocation_pct ?? 0;
          return (
            <div key={i} className="px-7 py-5 hover:bg-foreground/[0.02] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-medium text-foreground truncate">
                      {holding.name}
                    </h3>
                    {holding.ticker && (
                      <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                        {holding.ticker}
                      </span>
                    )}
                    <Badge variant="outline" className={cn("text-xs", config.color)}>
                      {config.label}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {holding.plain_english}
                  </p>

                  <p className="mt-1.5 text-sm text-foreground/70 italic">
                    {holding.verdict_reason}
                  </p>

                  {/* ER scale */}
                  {holding.expense_ratio_pct != null && (
                    <ERDot er={holding.expense_ratio_pct} verdict={holding.verdict} />
                  )}
                </div>

                <div className="text-right shrink-0 space-y-1.5 min-w-[100px]">
                  {holding.balance_usd != null && (
                    <p className="font-serif text-xl font-semibold text-foreground nums">
                      {formatUSD(holding.balance_usd)}
                    </p>
                  )}
                  {/* Allocation bar */}
                  {allocPct > 0 && (
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-20 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", allocationBarColor[holding.verdict])}
                          style={{ width: `${Math.min(100, allocPct)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-left nums">
                        {formatPct(allocPct, 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ER legend footnote */}
      <div className="px-7 py-3 border-t border-border/30 bg-muted/10">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          ER scale 0% → 1.5% · gold marker = 0.10% <FinanceTerm term="index fund">index fund</FinanceTerm> benchmark
        </p>
      </div>
    </div>
  );
}


