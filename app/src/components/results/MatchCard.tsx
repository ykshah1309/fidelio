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
    <div id="match" className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden h-full">
      <div className="px-7 py-5 border-b border-border/50">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          V · Free Money Check
        </span>
        <h2 className="font-serif text-2xl font-bold tracking-editorial text-foreground mt-0.5">
          <FinanceTerm term="employer match">Employer Match</FinanceTerm>
        </h2>
      </div>

      <div className="px-7 py-6">
        {/* Money left on table — lead with this */}
        {hasGap && (
          <div className="animate-pulse-once rounded-lg border border-oxblood/40 bg-oxblood/10 px-5 py-4 mb-6">
            <p className="text-sm text-oxblood font-medium">
              You&apos;re leaving{" "}
              <span className="font-serif text-3xl font-bold text-oxblood nums">
                {formatUSD(matchAnalysis.money_left_on_table_annual_usd)}
              </span>
              <span className="text-sm">/year in free employer money on the table.</span>
            </p>
          </div>
        )}
        {!hasGap && (
          <div className="rounded-lg border border-forest/40 bg-forest/10 px-5 py-4 mb-6">
            <p className="text-sm text-forest font-medium">
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
            <div className="relative h-3 w-full rounded-full bg-foreground/10 overflow-hidden">
              {/* Your contribution */}
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-out",
                  isFullCapture ? "bg-forest" : "bg-gold",
                )}
                style={{ width: `${fillRatio * 100}%` }}
              />
            </div>
            {/* Cap marker */}
            <div className="flex items-center justify-between mt-1">
              <div className="h-1.5 w-px bg-foreground/20 ml-[calc(100%-2px)]" />
            </div>
            {!isFullCapture && (
              <p className="mt-2 text-xs text-muted-foreground/70">
                Increase contribution by{" "}
                <span className="text-gold font-medium nums">
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
              <p className="font-serif text-3xl font-bold text-foreground nums">
                {formatPct(matchAnalysis.current_contribution_pct, 0)}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Your contribution
              </p>
            </div>
          )}
          {matchAnalysis.employer_match_rate_pct != null && (
            <div>
              <p className="font-serif text-3xl font-bold text-foreground nums">
                {formatPct(matchAnalysis.employer_match_rate_pct, 0)}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Match rate
              </p>
            </div>
          )}
          {matchAnalysis.employer_match_cap_pct != null && (
            <div>
              <p className="font-serif text-3xl font-bold text-foreground nums">
                {formatPct(matchAnalysis.employer_match_cap_pct, 0)}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
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
