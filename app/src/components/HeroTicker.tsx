"use client";

import { useEffect, useState } from "react";

const INSIGHTS = [
  {
    label: "Lifetime fee drag",
    value: "$138,420",
    detail: "for the average American 401(k) holder",
    tone: "oxblood" as const,
  },
  {
    label: "Match unclaimed",
    value: "23%",
    detail: "of free employer money — left on the table",
    tone: "oxblood" as const,
  },
  {
    label: "Avg overpay",
    value: "0.45%",
    detail: "above what an index fund would cost",
    tone: "oxblood" as const,
  },
  {
    label: "Workers in the dark",
    value: "43%",
    detail: "don't know their plan's expense ratios",
    tone: "oxblood" as const,
  },
];

const TONE_CLASS = {
  oxblood: "text-oxblood",
  forest: "text-forest",
  gold: "text-gold",
} as const;

export function HeroTicker() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % INSIGHTS.length), 3200);
    return () => clearInterval(t);
  }, []);

  const current = INSIGHTS[i];
  return (
    <div className="mt-8 inline-flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm px-6 py-4 min-w-[300px]">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
        {current.label}
      </span>
      <span
        key={i}
        className={`animate-ticker-in font-serif text-4xl font-bold nums ${TONE_CLASS[current.tone]}`}
      >
        {current.value}
      </span>
      <span key={`d-${i}`} className="animate-ticker-in text-xs text-muted-foreground">
        {current.detail}
      </span>
      {/* progress dots */}
      <div className="mt-1 flex items-center gap-1">
        {INSIGHTS.map((_, idx) => (
          <span
            key={idx}
            className={`h-1 rounded-full transition-all ${
              idx === i ? "w-4 bg-gold" : "w-1 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
