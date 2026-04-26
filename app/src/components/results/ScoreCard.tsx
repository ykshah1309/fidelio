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
  let erScore = 20;
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
      erScore = Math.max(
        0,
        Math.min(40, Math.round(40 * (1 - Math.max(0, blendedER - 0.1) / 0.9))),
      );
    }
  }

  // ── 2. Match capture score (0–30 pts) ─────────────────────────────────────
  let matchScore = 15;
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
  A: { ring: "stroke-forest", text: "text-forest" },
  B: { ring: "stroke-forest", text: "text-forest" },
  C: { ring: "stroke-gold", text: "text-gold" },
  D: { ring: "stroke-gold", text: "text-gold" },
  F: { ring: "stroke-oxblood", text: "text-oxblood" },
};

const barConfig = {
  er: { label: "Fee efficiency", color: "bg-gold" },
  match: { label: "Match capture", color: "bg-forest" },
  div: { label: "Diversification", color: "bg-gold-soft" },
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
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm"
    >
      {/* Eyebrow strip */}
      <div className="px-7 pt-6 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          Portfolio Health Score
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
          0 — 100
        </span>
      </div>

      <div className="px-7 pt-4 pb-7 flex flex-col sm:flex-row items-center gap-7">
        {/* Ring gauge */}
        <div className="relative shrink-0 h-28 w-28">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 88 88">
            <circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-foreground/10"
            />
            <circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - filled}
              className={cn("transition-all duration-1000 ease-out", config.ring)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-serif text-4xl font-bold", config.text)}>{grade}</span>
            <span className="font-mono text-[10px] text-muted-foreground nums">{score}/100</span>
          </div>
        </div>

        {/* Text + breakdown */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p className="font-serif text-base sm:text-lg leading-snug text-foreground">
            {verdict}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground/80 italic">{suggestion}</p>

          {/* Score breakdown bars */}
          <div className="mt-5 space-y-2.5">
            {[
              { label: barConfig.er.label, value: erScore, max: 40, color: barConfig.er.color, detail: blendedER != null ? `${blendedER.toFixed(2)}% blended ER` : "no ER data" },
              { label: barConfig.match.label, value: matchScore, max: 30, color: barConfig.match.color, detail: matchScore === 30 ? "capturing full match" : matchScore < 10 ? "leaving money on table" : "partial capture" },
              { label: barConfig.div.label, value: divScore, max: 30, color: barConfig.div.color, detail: `${Math.min(4, Math.round(divScore / 8))} fund categories` },
            ].map(({ label, value, max, color, detail }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-32 text-xs text-muted-foreground shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-1000 ease-out", color)}
                    style={{ width: `${(value / max) * 100}%` }}
                  />
                </div>
                <span className="w-32 text-xs text-muted-foreground/60 shrink-0 text-right nums">
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
