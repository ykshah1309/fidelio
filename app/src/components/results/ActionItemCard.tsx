"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";
import { formatUSD, cn } from "@/lib/utils";

interface ActionItemCardProps {
  actionItems: Report["action_items"];
}

const effortConfig = {
  "5_minutes": { label: "5 min", color: "text-emerald-400 bg-emerald-500/15" },
  "30_minutes": { label: "30 min", color: "text-sky-400 bg-sky-500/15" },
  this_week: { label: "This week", color: "text-amber-400 bg-amber-500/15" },
};

const CONSEQUENTIAL_KEYWORDS = [
  "contribution", "transfer", "rollover", "withdraw", "rebalance",
  "change investment", "move", "switch fund",
];

function isConsequential(detail: string): boolean {
  const lower = detail.toLowerCase();
  return CONSEQUENTIAL_KEYWORDS.some((kw) => lower.includes(kw));
}

export function ActionItemCard({ actionItems }: ActionItemCardProps) {
  const [done, setDone] = useState<boolean[]>(actionItems.map(() => false));
  const [copied, setCopied] = useState<boolean[]>(actionItems.map(() => false));

  if (!actionItems || actionItems.length === 0) return null;

  function toggleDone(i: number) {
    setDone((prev) => prev.map((v, j) => (j === i ? !v : v)));
  }

  async function copySteps(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied((prev) => prev.map((v, j) => (j === i ? true : v)));
      setTimeout(() => {
        setCopied((prev) => prev.map((v, j) => (j === i ? false : v)));
      }, 2000);
    } catch {
      // clipboard unavailable — silent fail
    }
  }

  return (
    <div id="actions" className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <h2 className="text-lg font-semibold text-foreground">
          Three Things to Do This Week
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Concrete, specific, doable without a financial advisor.
        </p>
      </div>

      <div className="divide-y divide-border/30">
        {actionItems.map((item, i) => {
          const effort = effortConfig[item.effort];
          const isDone = done[i];
          const isCopied = copied[i];
          const showFriction = isConsequential(item.detail);

          return (
            <div
              key={i}
              className={cn(
                "px-6 py-5 transition-colors",
                isDone && "opacity-60",
              )}
            >
              <div className="flex items-start gap-4">
                {/* Number / checkmark */}
                <button
                  onClick={() => toggleDone(i)}
                  title={isDone ? "Mark as not done" : "Mark as done"}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                    isDone
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                      : "border-primary/20 bg-primary/10 text-primary hover:border-primary/40",
                  )}
                >
                  {isDone ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className={cn("font-medium text-foreground", isDone && "line-through")}>
                      {item.title}
                    </h3>
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                        effort.color,
                      )}
                    >
                      {effort.label}
                    </span>
                    {item.impact_usd_annual != null && (
                      <span className="text-xs text-emerald-400 font-medium">
                        +{formatUSD(item.impact_usd_annual)}/yr
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {item.detail}
                  </p>

                  {/* Friction callout for consequential actions */}
                  {showFriction && !isDone && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      <p className="text-xs text-amber-400/90 leading-relaxed">
                        This is a consequential change. Verify the steps with your plan administrator before acting.
                      </p>
                    </div>
                  )}

                  {/* Copy button */}
                  <button
                    onClick={() => copySteps(i, `${item.title}\n\n${item.detail}`)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                        </svg>
                        Copy steps
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline educational disclaimer */}
      <div className="px-6 py-3 border-t border-border/30 bg-muted/10 flex items-start gap-2">
        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <p className="text-xs text-muted-foreground/60 leading-relaxed">
          These are educational observations, not financial advice. Review any changes with your plan administrator or a licensed financial advisor before acting.
        </p>
      </div>
    </div>
  );
}