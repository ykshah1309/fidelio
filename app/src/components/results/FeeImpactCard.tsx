"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";
import { formatUSD } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { FinanceTerm } from "@/components/ui/FinanceTerm";

interface FeeImpactCardProps {
  feeImpact: Report["fee_impact"];
}

// Low-cost benchmark: ~0.05% blended ER on same assumed balance/return
function benchmarkCost(current: number | null | undefined): number | null {
  if (current == null) return null;
  return Math.round(current * 0.07);
}

/**
 * Build year-by-year compounding data.
 * Assumptions: starting from year 0 costs of 0, compounding at 7% growth.
 * We interpolate between the three data points (10, 20, 30 yr) using
 * exponential interpolation, which is close enough for display.
 */
function buildCompoundData(
  ten: number | null | undefined,
  twenty: number | null | undefined,
  thirty: number | null | undefined,
) {
  if (!ten || !twenty || !thirty) return null;
  const t = ten;
  const tw = twenty;
  const th = thirty;
  const benchT = benchmarkCost(t) ?? 0;
  const benchTw = benchmarkCost(tw) ?? 0;
  const benchTh = benchmarkCost(th) ?? 0;

  function interpolate(year: number): { yours: number; bench: number } {
    let yours: number;
    let bench: number;
    if (year <= 10) {
      const f = year / 10;
      yours = t * f;
      bench = benchT * f;
    } else if (year <= 20) {
      const f = (year - 10) / 10;
      yours = t + (tw - t) * f;
      bench = benchT + (benchTw - benchT) * f;
    } else {
      const f = (year - 20) / 10;
      yours = tw + (th - tw) * f;
      bench = benchTw + (benchTh - benchTw) * f;
    }
    return { yours: Math.round(yours), bench: Math.round(bench) };
  }

  return Array.from({ length: 31 }, (_, i) => ({
    year: i,
    ...interpolate(i),
  }));
}

// Custom tooltip for recharts bar chart
const FeeTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={p.name === "Your fees" ? "text-rose-400" : "text-emerald-400"}>
          {p.name}: {formatUSD(p.value)}
        </p>
      ))}
      {payload.length === 2 && payload[0].value > payload[1].value && (
        <p className="mt-1 text-muted-foreground border-t border-border pt-1">
          You could save {formatUSD(payload[0].value - payload[1].value)}
        </p>
      )}
    </div>
  );
};

// Custom tooltip for line chart
const LineTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground mb-1">Year {label}</p>
      {payload.map((p, i) => (
        <p key={i} className={p.name === "Your fees" ? "text-rose-400" : "text-emerald-400"}>
          {p.name}: {formatUSD(p.value)}
        </p>
      ))}
    </div>
  );
};

export function FeeImpactCard({ feeImpact }: FeeImpactCardProps) {
  const [activeTab, setActiveTab] = useState<"bar" | "line">("line");

  if (!feeImpact) return null;

  const periods = [
    {
      label: "10 yr",
      current: feeImpact.ten_year_cost_usd,
      benchmark: benchmarkCost(feeImpact.ten_year_cost_usd),
    },
    {
      label: "20 yr",
      current: feeImpact.twenty_year_cost_usd,
      benchmark: benchmarkCost(feeImpact.twenty_year_cost_usd),
    },
    {
      label: "30 yr",
      current: feeImpact.thirty_year_cost_usd,
      benchmark: benchmarkCost(feeImpact.thirty_year_cost_usd),
    },
  ];

  const chartData = periods.map((p) => ({
    name: p.label,
    "Your fees": p.current ?? 0,
    "Low-cost equivalent": p.benchmark ?? 0,
  }));

  const compoundData = buildCompoundData(
    feeImpact.ten_year_cost_usd,
    feeImpact.twenty_year_cost_usd,
    feeImpact.thirty_year_cost_usd,
  );

  const hasChart = periods.some((p) => p.current != null && p.current > 0);

  return (
    <div id="fees" className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <h2 className="text-lg font-semibold text-foreground">
          What It&apos;s Costing You
        </h2>
        {feeImpact.annual_fees_usd != null && (
          <p className="text-sm text-muted-foreground mt-1">
            You&apos;re paying about{" "}
            <span className="text-amber-400 font-medium">
              {formatUSD(feeImpact.annual_fees_usd)}/year
            </span>{" "}
            in <FinanceTerm term="expense ratios">fund fees</FinanceTerm> right now.
          </p>
        )}
      </div>

      {/* Tab switcher */}
      {hasChart && (
        <div className="px-6 pt-4 flex items-center gap-1 border-b border-border/30">
          <button
            onClick={() => setActiveTab("line")}
            className={`text-xs px-3 py-1.5 rounded-t-md border-b-2 transition-colors ${
              activeTab === "line"
                ? "border-amber-500 text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Compounding curve
          </button>
          <button
            onClick={() => setActiveTab("bar")}
            className={`text-xs px-3 py-1.5 rounded-t-md border-b-2 transition-colors ${
              activeTab === "bar"
                ? "border-amber-500 text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Snapshot comparison
          </button>
        </div>
      )}

      {/* Line chart — compounding curve */}
      {hasChart && activeTab === "line" && compoundData && (
        <div className="px-4 pt-5 pb-2">
          <div className="flex items-center gap-4 px-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-sm bg-rose-500/70" />
              Your current fees
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70" />
              Low-cost equivalent (0.05% ER)
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={compoundData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="year"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(215 14% 55%)" }}
                tickFormatter={(v) => v % 5 === 0 ? `yr ${v}` : ""}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(215 14% 55%)" }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={44}
              />
              <Tooltip content={<LineTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
              <Line
                type="monotone"
                dataKey="yours"
                name="Your fees"
                stroke="rgba(244, 63, 94, 0.8)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="bench"
                name="Low-cost equivalent"
                stroke="rgba(52, 211, 153, 0.8)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          {feeImpact.thirty_year_cost_usd && (
            <p className="text-center text-xs text-rose-400/80 mt-1">
              The gap at year 30:{" "}
              <span className="font-semibold text-rose-400">
                {formatUSD(feeImpact.thirty_year_cost_usd - (benchmarkCost(feeImpact.thirty_year_cost_usd) ?? 0))}
              </span>{" "}
              more than a low-cost alternative.
            </p>
          )}
        </div>
      )}

      {/* Bar chart comparison */}
      {hasChart && activeTab === "bar" && (
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center gap-4 px-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-sm bg-rose-500/70" />
              Your current fees
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70" />
              Low-cost equivalent (0.05% ER)
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(215 14% 55%)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(215 14% 55%)" }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip content={<FeeTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="Your fees" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="rgba(244, 63, 94, 0.65)" />
                ))}
              </Bar>
              <Bar dataKey="Low-cost equivalent" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="rgba(52, 211, 153, 0.65)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-3 divide-x divide-border/30">
        {periods.map((period) => (
          <div key={period.label} className="px-4 py-5 text-center">
            <p className="text-2xl font-bold text-rose-400">
              {formatUSD(period.current)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">
              {period.label}
            </p>
            {period.benchmark != null && period.current != null && period.current > 0 && (
              <p className="mt-1 text-xs text-emerald-500/70">
                vs. {formatUSD(period.benchmark)} low-cost
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="px-6 py-4 border-t border-border/30 bg-muted/20">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {feeImpact.explanation}
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70 italic">
          {feeImpact.assumptions}
        </p>
      </div>
    </div>
  );
}
