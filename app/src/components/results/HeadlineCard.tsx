"use client";

import { useEffect, useState, useRef } from "react";
import type { Report } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HeadlineCardProps {
  headline: Report["headline"];
}

const severityConfig = {
  info: {
    label: "Looking Good",
    accent: "text-forest",
    badge: "border-forest/40 bg-forest/10 text-forest",
    bar: "bg-forest",
    big: "text-forest",
    glow: "from-forest/20 via-transparent to-transparent",
  },
  warning: {
    label: "Needs Attention",
    accent: "text-gold",
    badge: "border-gold/40 bg-gold/10 text-gold",
    bar: "bg-gold",
    big: "text-gold",
    glow: "from-gold/20 via-transparent to-transparent",
  },
  critical: {
    label: "Urgent",
    accent: "text-oxblood",
    badge: "border-oxblood/40 bg-oxblood/10 text-oxblood",
    bar: "bg-oxblood",
    big: "text-oxblood",
    glow: "from-oxblood/20 via-transparent to-transparent",
  },
};

function formatUSDShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString()}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function useCountUp(target: number, duration = 1000): number {
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

/** Word-wrap helper for canvas */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY;
}

async function downloadShareImage(
  amount: string,
  oneLine: string,
  severityLabel: string,
  isDark: boolean,
) {
  // Ensure web fonts are loaded before rasterizing
  try {
    await Promise.all([
      document.fonts.load("800 200px Fraunces"),
      document.fonts.load("500 32px Inter"),
      document.fonts.load("600 16px Inter"),
    ]);
  } catch {
    /* fonts may already be available */
  }

  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Palette
  const bg = isDark ? "#0E0C0B" : "#F4EFE6";
  const fg = isDark ? "#ECE3D2" : "#181412";
  const muted = isDark ? "#7A6E60" : "#6E6052";
  const gold = isDark ? "#C8A063" : "#A87E45";
  const accent =
    severityLabel === "Urgent"
      ? "#C8554B"
      : severityLabel === "Needs Attention"
        ? gold
        : "#6FA078";

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial vignette in accent
  const grad = ctx.createRadialGradient(W * 0.7, H * 0.2, 50, W * 0.7, H * 0.2, 800);
  grad.addColorStop(0, accent + "33");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Watermark glyph — huge $ behind number
  ctx.font = "800 800px Fraunces";
  ctx.fillStyle = fg + "08";
  ctx.fillText("$", W - 380, 880);

  // Top accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(80, 80, 60, 4);

  // Nameplate
  ctx.fillStyle = gold;
  ctx.font = "600 18px Inter";
  ctx.fillText("FIDELIO  ·  A FAITHFUL READER", 80, 130);

  // Severity badge
  ctx.fillStyle = muted;
  ctx.font = "500 16px Inter";
  ctx.fillText(severityLabel.toUpperCase(), 80, 220);

  // Big number
  ctx.fillStyle = accent;
  ctx.font = "800 220px Fraunces";
  ctx.fillText(amount, 80, 460);

  // One-line
  ctx.fillStyle = fg;
  ctx.font = "500 38px Inter";
  const endY = wrapText(ctx, oneLine, 80, 560, W - 160, 56);

  // Divider
  ctx.fillStyle = fg + "22";
  ctx.fillRect(80, endY + 80, W - 160, 1);

  // Tagline
  ctx.fillStyle = muted;
  ctx.font = "italic 500 26px Fraunces";
  ctx.fillText("Your 401(k) is trying to tell you something.", 80, endY + 140);

  // Footer URL / call
  ctx.fillStyle = fg;
  ctx.font = "600 22px Inter";
  ctx.fillText("Find out yours →  fidelio.app", 80, H - 90);

  // Bottom-right ornament
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(W - 100, H - 100, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W - 100, H - 100, 6, 0, Math.PI * 2);
  ctx.fillStyle = gold;
  ctx.fill();

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fidelio-insight.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

export function HeadlineCard({ headline }: HeadlineCardProps) {
  const config = severityConfig[headline.severity];
  const animated = useCountUp(headline.dollar_amount ?? 0);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const isDark = document.documentElement.classList.contains("dark");
    await downloadShareImage(
      formatUSDShort(headline.dollar_amount ?? 0),
      headline.one_line,
      config.label,
      isDark,
    );
    setShared(true);
    setTimeout(() => setShared(false), 2200);
  }

  async function handleCopy() {
    const text = `${formatUSDShort(headline.dollar_amount ?? 0)} — ${headline.one_line}\n\nFidelio. A faithful reader of documents you shouldn't have to decode.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silent */
    }
  }

  return (
    <div
      id="headline"
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm"
    >
      {/* Top accent bar — severity */}
      <div className={cn("h-[3px] w-full", config.bar)} />

      {/* Glow + watermark */}
      <div
        className={cn(
          "pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl bg-gradient-to-br",
          config.glow,
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -bottom-24 font-serif font-bold text-foreground/[0.04] select-none"
        style={{ fontSize: "26rem", lineHeight: 1 }}
      >
        $
      </div>

      <div className="relative px-8 py-10 sm:py-12">
        {/* Eyebrow */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            The Headline
          </span>
          <span
            className={cn(
              "inline-block rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest",
              config.badge,
            )}
          >
            {config.label}
          </span>
        </div>

        {/* Big number */}
        <p
          className={cn(
            "mt-6 font-serif font-bold tracking-editorial nums leading-none",
            "text-7xl sm:text-8xl",
            config.big,
          )}
        >
          {formatUSDShort(animated)}
        </p>

        {/* One-line story */}
        <p className="mt-5 max-w-2xl text-lg sm:text-xl text-foreground/90 leading-relaxed font-serif">
          {headline.one_line}
        </p>

        {/* Hairline */}
        <div className="hairline mt-8" />

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={handleShare}
            className={cn(
              "group flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-medium uppercase tracking-widest font-mono text-gold hover:bg-gold/20 hover:border-gold transition-all",
              "data-print-hide",
            )}
            data-print-hide
          >
            {shared ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Saved
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                Save as image
              </>
            )}
          </button>
          <button
            onClick={handleCopy}
            data-print-hide
            className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-4 py-2 text-xs font-medium uppercase tracking-widest font-mono text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5 text-forest" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
                Copy quote
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
