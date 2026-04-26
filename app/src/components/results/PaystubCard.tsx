"use client";

import type { Report, Extraction } from "@/lib/types";
import { formatUSD, formatPct, cn } from "@/lib/utils";
import { FinanceTerm } from "@/components/ui/FinanceTerm";

interface PaystubCardProps {
  report: Report;
  extraction: Extraction;
}

const DEDUCTION_COLORS: Record<string, string> = {
  federal_tax: "bg-oxblood",
  state_tax: "bg-oxblood/70",
  fica: "bg-gold",
  medicare: "bg-gold-soft",
  retirement: "bg-forest",
  health_insurance: "bg-forest/60",
  dental: "bg-forest/40",
  vision: "bg-gold/50",
  hsa: "bg-forest/80",
  fsa: "bg-forest/50",
  other: "bg-muted-foreground",
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
    <div id="paystub" className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden h-full">
      <div className="px-7 py-5 border-b border-border/50">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          VI · Paystub Anatomy
        </span>
        <h2 className="font-serif text-2xl font-bold tracking-editorial text-foreground mt-0.5">Paystub Breakdown</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Where your{" "}
          <FinanceTerm term="gross pay">gross pay</FinanceTerm>
          {" "}goes before it hits your bank account.
        </p>
      </div>

      {/* Stacked deduction bar */}
      {gross != null && deductions.length > 0 && (
        <div className="px-7 py-5 border-b border-border/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              <FinanceTerm term="gross pay">Gross</FinanceTerm>:{" "}
              <span className="text-foreground font-semibold nums">{formatUSD(gross)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              <FinanceTerm term="net pay">Take-home</FinanceTerm>:{" "}
              <span className="text-forest font-semibold nums">{formatUSD(net)}</span>
            </span>
          </div>

          {/* Stacked bar */}
          <div className="h-4 rounded-full overflow-hidden flex bg-foreground/5">
            {/* Net pay segment */}
            {net != null && gross > 0 && (
              <div
                className="bg-forest h-full"
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
                <div className="h-2 w-2 rounded-full bg-forest" />
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
        <div className="px-7 py-5 space-y-4">
          {/* Withholding check */}
          <div>
            <p className="font-mono text-[10px] font-medium text-muted-foreground/80 uppercase tracking-widest mb-1.5">
              <FinanceTerm term="withholding">Withholding</FinanceTerm> Check
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {notes.withholding_check}
            </p>
          </div>

          {/* Retirement note */}
          {notes.retirement_note && (
            <div>
              <p className="font-mono text-[10px] font-medium text-muted-foreground/80 uppercase tracking-widest mb-1.5">
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
              <p className="font-mono text-[10px] font-medium text-muted-foreground/80 uppercase tracking-widest mb-2">
                Flags
              </p>
              <ul className="space-y-2">
                {notes.flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-gold"
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
        <div className="px-7 py-4 border-t border-border/30 bg-muted/20">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground"><FinanceTerm term="ytd">YTD</FinanceTerm> Gross: </span>
              <span className="text-foreground font-medium nums">{formatUSD(paystub.ytd_gross)}</span>
            </div>
            {paystub.ytd_net != null && (
              <div>
                <span className="text-muted-foreground">YTD Take-home: </span>
                <span className="text-foreground font-medium nums">{formatUSD(paystub.ytd_net)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
