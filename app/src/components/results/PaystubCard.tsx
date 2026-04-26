"use client";

import type { Report, Extraction } from "@/lib/types";
import { formatUSD, formatPct, cn } from "@/lib/utils";
import { FinanceTerm } from "@/components/ui/FinanceTerm";

interface PaystubCardProps {
  report: Report;
  extraction: Extraction;
}

const DEDUCTION_COLORS: Record<string, string> = {
  federal_tax: "bg-rose-500",
  state_tax: "bg-orange-500",
  fica: "bg-amber-500",
  medicare: "bg-yellow-500",
  retirement: "bg-emerald-500",
  health_insurance: "bg-sky-500",
  dental: "bg-blue-500",
  vision: "bg-violet-500",
  hsa: "bg-teal-500",
  fsa: "bg-cyan-500",
  other: "bg-zinc-500",
};

const DEDUCTION_LABELS: Record<string, string> = {
  federal_tax: "Federal Tax",
  state_tax: "State Tax",
  fica: "Social Security",
  medicare: "Medicare",
  retirement: "Retirement",
  health_insurance: "Health Insurance",
  dental: "Dental",
  vision: "Vision",
  hsa: "HSA",
  fsa: "FSA",
  other: "Other",
};

export function PaystubCard({ report, extraction }: PaystubCardProps) {
  const paystub = extraction.paystub;
  const notes = report.paystub_notes;

  // Need at least one of these to show something useful
  if (!paystub && !notes) return null;
  if (!notes && (!paystub?.gross_pay && !paystub?.net_pay)) return null;

  // Build deduction breakdown for the visual bar
  const gross = paystub?.gross_pay;
  const net = paystub?.net_pay;
  const deductions = paystub?.deductions ?? [];

  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

  // Group deductions by type for the stacked bar
  const grouped: Record<string, number> = {};
  for (const d of deductions) {
    grouped[d.type] = (grouped[d.type] ?? 0) + d.amount;
  }
  const groupedEntries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);

  return (
    <div id="paystub" className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <h2 className="text-lg font-semibold text-foreground">Paystub Breakdown</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Where your{" "}
          <FinanceTerm term="gross pay">gross pay</FinanceTerm>
          {" "}goes before it hits your bank account.
        </p>
      </div>

      {/* Stacked deduction bar */}
      {gross != null && deductions.length > 0 && (
        <div className="px-6 py-5 border-b border-border/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              <FinanceTerm term="gross pay">Gross</FinanceTerm>:{" "}
              <span className="text-foreground font-semibold">{formatUSD(gross)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              <FinanceTerm term="net pay">Take-home</FinanceTerm>:{" "}
              <span className="text-emerald-400 font-semibold">{formatUSD(net)}</span>
            </span>
          </div>

          {/* Stacked bar */}
          <div className="h-4 rounded-full overflow-hidden flex bg-white/5">
            {/* Net pay segment */}
            {net != null && gross > 0 && (
              <div
                className="bg-emerald-500/70 h-full"
                style={{ width: `${Math.max(0, (net / gross) * 100)}%` }}
                title={`Take-home: ${formatUSD(net)}`}
              />
            )}
            {/* Deduction segments */}
            {groupedEntries.map(([type, amount]) => (
              <div
                key={type}
                className={cn("h-full opacity-80", DEDUCTION_COLORS[type] ?? "bg-zinc-500")}
                style={{ width: `${(amount / gross) * 100}%` }}
                title={`${DEDUCTION_LABELS[type] ?? type}: ${formatUSD(amount)}`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {net != null && (
              <div className="flex items-center gap-1.5 text-xs">
                <div className="h-2 w-2 rounded-full bg-emerald-500/70" />
                <span className="text-muted-foreground">
                  Take-home{" "}
                  <span className="text-foreground font-medium">
                    {formatUSD(net)}
                  </span>{" "}
                  ({formatPct((net / gross) * 100, 0)})
                </span>
              </div>
            )}
            {groupedEntries.map(([type, amount]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs">
                <div
                  className={cn("h-2 w-2 rounded-full opacity-80", DEDUCTION_COLORS[type] ?? "bg-zinc-500")}
                />
                <span className="text-muted-foreground">
                  {DEDUCTION_LABELS[type] ?? type}{" "}
                  <span className="text-foreground font-medium">{formatUSD(amount)}</span>
                  {gross > 0 && (
                    <span className="text-muted-foreground/60">
                      {" "}({formatPct((amount / gross) * 100, 0)})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withholding check + notes */}
      {notes && (
        <div className="px-6 py-5 space-y-4">
          {/* Withholding check */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <FinanceTerm term="withholding">Withholding</FinanceTerm> Check
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {notes.withholding_check}
            </p>
          </div>

          {/* Retirement note */}
          {notes.retirement_note && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Retirement Contribution
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {notes.retirement_note}
              </p>
            </div>
          )}

          {/* Flags */}
          {notes.flags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Flags
              </p>
              <ul className="space-y-2">
                {notes.flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                      />
                    </svg>
                    <span className="text-sm text-foreground/90 leading-relaxed">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* YTD summary if available */}
      {paystub?.ytd_gross != null && (
        <div className="px-6 py-4 border-t border-border/30 bg-muted/20">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground"><FinanceTerm term="ytd">YTD</FinanceTerm> Gross: </span>
              <span className="text-foreground font-medium">{formatUSD(paystub.ytd_gross)}</span>
            </div>
            {paystub.ytd_net != null && (
              <div>
                <span className="text-muted-foreground">YTD Take-home: </span>
                <span className="text-foreground font-medium">{formatUSD(paystub.ytd_net)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
