"use client";

import type { Report } from "@/lib/types";
import { formatUSD, formatPct, cn } from "@/lib/utils";
import { FinanceTerm } from "@/components/ui/FinanceTerm";

interface MatchCardProps {
  matchAnalysis: Report["match_analysis"];
}

export function MatchCard({ matchAnalysis }: MatchCardProps) {
  if (!matchAnalysis) return null;

  const hasGap =
    matchAnalysis.money_left_on_table_annual_usd != null &&
    matchAnalysis.money_left_on_table_annual_usd > 0;

  const capPct = matchAnalysis.employer_match_cap_pct ?? 0;
  const currentPct = matchAnalysis.current_contribution_pct ?? 0;
  const fillRatio = capPct > 0 ? Math.min(1, currentPct / capPct) : null;
  const isFullCapture = fillRatio === 1 || !hasGap;

  return (
    <div id="match" className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <h2 className="text-lg font-semibold text-foreground">
          <FinanceTerm term="employer match">Employer Match</FinanceTerm>
        </h2>
      </div>

      <div className="px-6 py-6">
        {/* Money left on table — lead with this */}
        {hasGap && (
          <div className="animate-pulse-once rounded-lg border border-rose-500/30 bg-rose-500/10 px-5 py-4 mb-6">
            <p className="text-sm text-rose-300 font-medium">
              You&apos;re leaving{" "}
              <span className="text-2xl font-bold text-rose-400">
                {formatUSD(matchAnalysis.money_left_on_table_annual_usd)}
              </span>
              /year in free employer money on the table.
            </p>
          </div>
        )}
        {!hasGap && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 mb-6">
            <p className="text-sm text-emerald-300 font-medium">
              ✓ You&apos;re capturing your full employer match. Nice work.
            </p>
          </div>
        )}

        {/* Contribution gauge */}
        {fillRatio != null && capPct > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Your contribution: <span className="text-foreground font-medium">{formatPct(currentPct, 0)}</span></span>
              <span>Match cap: <span className="text-foreground font-medium">{formatPct(capPct, 0)}</span></span>
            </div>
            <div className="relative h-3 w-full rounded-full bg-white/10 overflow-hidden">
              {/* Your contribution */}
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isFullCapture ? "bg-emerald-500" : "bg-amber-500",
                )}
                style={{ width: `${fillRatio * 100}%` }}
              />
            </div>
            {/* Cap marker */}
            <div className="flex items-center justify-between mt-1">
              <div className="h-1.5 w-px bg-white/20 ml-[calc(100%-2px)]" />
            </div>
            {!isFullCapture && (
              <p className="mt-2 text-xs text-muted-foreground/70">
                Increase contribution by{" "}
                <span className="text-amber-400 font-medium">
                  {formatPct(capPct - currentPct, 0)}
                </span>{" "}
                to capture the full match.
              </p>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {matchAnalysis.current_contribution_pct != null && (
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatPct(matchAnalysis.current_contribution_pct, 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your contribution
              </p>
            </div>
          )}
          {matchAnalysis.employer_match_rate_pct != null && (
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatPct(matchAnalysis.employer_match_rate_pct, 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Match rate
              </p>
            </div>
          )}
          {matchAnalysis.employer_match_cap_pct != null && (
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatPct(matchAnalysis.employer_match_cap_pct, 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Match cap
              </p>
            </div>
          )}
        </div>

        <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
          {matchAnalysis.plain_english}
        </p>
      </div>
    </div>
  );
}
