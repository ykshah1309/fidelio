"use client";

import { useEffect, useState, useRef } from "react";
import type { Report } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HeadlineCardProps {
  headline: Report["headline"];
}

const severityConfig = {
  info: {
    bg: "from-emerald-500/20 to-emerald-600/5",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-300",
    label: "Looking good",
  },
  warning: {
    bg: "from-amber-500/20 to-amber-600/5",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-300",
    label: "Needs attention",
  },
  critical: {
    bg: "from-rose-500/20 to-rose-600/5",
    border: "border-rose-500/30",
    text: "text-rose-400",
    badge: "bg-rose-500/20 text-rose-300",
    label: "Urgent",
  },
};

function formatUSDShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString()}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

/** Count-up hook: animates from 0 to target over ~800ms */
function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    setValue(0);

    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

export function HeadlineCard({ headline }: HeadlineCardProps) {
  const config = severityConfig[headline.severity];
  const animated = useCountUp(headline.dollar_amount ?? 0);

  return (
    <div
      id="headline"
      className={cn(
        "relative overflow-hidden rounded-2xl border p-8 bg-gradient-to-br",
        config.bg,
        config.border,
      )}
    >
      {/* Subtle glow effect */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-3xl" />

      <div className="relative">
        <span
          className={cn(
            "inline-block rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider",
            config.badge,
          )}
        >
          {config.label}
        </span>

        {/* Headline number — Playfair Display, large, counts up on load */}
        <p className={cn("mt-6 font-serif text-6xl sm:text-7xl font-bold tracking-tight tabular-nums", config.text)}>
          {formatUSDShort(animated)}
        </p>

        <p className="mt-4 text-lg text-foreground/90 leading-relaxed max-w-2xl">
          {headline.one_line}
        </p>
      </div>
    </div>
  );
}
