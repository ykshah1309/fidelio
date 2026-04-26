"use client";

import type { Report, Extraction } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  report: Report;
  extraction: Extraction;
}

interface ScoreBreakdown {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  blendedER: number | null;
  erScore: number;
  matchScore: number;
  divScore: number;
  verdict: string;
  suggestion: string;
}

function computeScore(report: Report, extraction: Extraction): ScoreBreakdown {
  // ── 1. Expense ratio score (0–40 pts) ─────────────────────────────────────
  const holdingsWithER = report.holdings_review.filter(
    (h) => h.expense_ratio_pct != null && h.balance_usd != null,
  );
  let erScore = 20; // neutral default
  let blendedER: number | null = null;

  if (holdingsWithER.length > 0) {
    const totalBal = holdingsWithER.reduce((s, h) => s + h.balance_usd!, 0);
    blendedER =
      totalBal > 0
        ? holdingsWithER.reduce(
            (s, h) => s + (h.balance_usd! / totalBal) * h.expense_ratio_pct!,
            0,
          )
        : null;

    if (blendedER != null) {
      // 0.10% → 40 pts, 1.0% → 0 pts, anything above 1.0% stays at 0
      erScore = Math.max(
        0,
        Math.min(40, Math.round(40 * (1 - Math.max(0, blendedER - 0.1) / 0.9))),
      );
    }
  }

  // ── 2. Match capture score (0–30 pts) ─────────────────────────────────────
  let matchScore = 15; // neutral if no data
  const match = report.match_analysis;
  if (match != null) {
    const gap = match.money_left_on_table_annual_usd ?? 0;
    if (gap <= 0) {
      matchScore = 30;
    } else if (
      match.current_contribution_pct != null &&
      match.employer_match_cap_pct != null &&
      match.employer_match_cap_pct > 0
    ) {
      const ratio = match.current_contribution_pct / match.employer_match_cap_pct;
      matchScore = Math.round(5 + 20 * Math.min(1, ratio));
    } else {
      matchScore = 5;
    }
  }

  // ── 3. Diversification score (0–30 pts) ───────────────────────────────────
  const cats = new Set(
    extraction.holdings.map((h) => h.category).filter(Boolean),
  );
  const divScore = Math.min(30, cats.size * 8);

  const total = Math.min(100, Math.max(0, erScore + matchScore + divScore));
  const grade: ScoreBreakdown["grade"] =
    total >= 90 ? "A" : total >= 75 ? "B" : total >= 60 ? "C" : total >= 45 ? "D" : "F";

  // Human verdict
  const erPart =
    blendedER == null
      ? "expense data unavailable"
      : blendedER <= 0.1
        ? "low-cost funds"
        : blendedER <= 0.3
          ? "slightly elevated fees"
          : "high fees";
  const matchPart =
    match == null
      ? null
      : (match.money_left_on_table_annual_usd ?? 0) <= 0
        ? "full employer match captured"
        : "leaving employer match on the table";
  const parts = [erPart, matchPart].filter(Boolean).join(" · ");
  const verdict = `${grade === "A" || grade === "B" ? "Looking good overall" : grade === "C" ? "Room for improvement" : "Needs attention"} — ${parts}.`;

  const suggestion =
    grade === "A"
      ? "Your portfolio is well-optimized. Review annually."
      : grade === "B"
        ? "Minor tweaks could push this to an A. See actions below."
        : grade === "C"
          ? "Two or three changes in the action items would significantly improve your score."
          : "The action items below address the biggest issues. Start with the first one this week.";

  return { score: total, grade, blendedER, erScore, matchScore, divScore, verdict, suggestion };
}

const gradeConfig = {
  A: { ring: "stroke-emerald-500", text: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-600/5", border: "border-emerald-500/25" },
  B: { ring: "stroke-sky-500", text: "text-sky-400", bg: "from-sky-500/15 to-sky-600/5", border: "border-sky-500/25" },
  C: { ring: "stroke-amber-500", text: "text-amber-400", bg: "from-amber-500/15 to-amber-600/5", border: "border-amber-500/25" },
  D: { ring: "stroke-orange-500", text: "text-orange-400", bg: "from-orange-500/15 to-orange-600/5", border: "border-orange-500/25" },
  F: { ring: "stroke-rose-500", text: "text-rose-400", bg: "from-rose-500/15 to-rose-600/5", border: "border-rose-500/25" },
};

const barConfig = {
  er: { label: "Fee efficiency", color: "bg-sky-500" },
  match: { label: "Match capture", color: "bg-emerald-500" },
  div: { label: "Diversification", color: "bg-violet-500" },
};

export function ScoreCard({ report, extraction }: ScoreCardProps) {
  const { score, grade, blendedER, erScore, matchScore, divScore, verdict, suggestion } =
    computeScore(report, extraction);
  const config = gradeConfig[grade];

  // SVG ring math
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div
      id="score"
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-6",
        config.bg,
        config.border,
      )}
    >
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Ring gauge */}
        <div className="relative shrink-0 h-24 w-24">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88">
            {/* Track */}
            <circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-white/10"
            />
            {/* Fill */}
            <circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - filled}
              className={config.ring}
            />
          </svg>
          {/* Grade letter in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-3xl font-bold", config.text)}>{grade}</span>
            <span className="text-xs text-muted-foreground">{score}/100</span>
          </div>
        </div>

        {/* Text + breakdown */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h2 className="text-base font-semibold text-foreground">Portfolio Health Score</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{verdict}</p>
          <p className="mt-1 text-xs text-muted-foreground/70 italic">{suggestion}</p>

          {/* Score breakdown bars */}
          <div className="mt-4 space-y-2">
            {[
              { label: barConfig.er.label, value: erScore, max: 40, color: barConfig.er.color, detail: blendedER != null ? `${blendedER.toFixed(2)}% blended ER` : "no ER data" },
              { label: barConfig.match.label, value: matchScore, max: 30, color: barConfig.match.color, detail: matchScore === 30 ? "capturing full match" : matchScore < 10 ? "leaving money on table" : "partial capture" },
              { label: barConfig.div.label, value: divScore, max: 30, color: barConfig.div.color, detail: `${Math.min(4, Math.round(divScore / 8))} fund categories` },
            ].map(({ label, value, max, color, detail }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-32 text-xs text-muted-foreground shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", color)}
                    style={{ width: `${(value / max) * 100}%` }}
                  />
                </div>
                <span className="w-28 text-xs text-muted-foreground/60 shrink-0 text-right">
                  {detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
