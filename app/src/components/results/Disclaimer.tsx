"use client";

import { STANDARD_DISCLAIMER } from "@/lib/prompts";

export function Disclaimer() {
  return (
    <div className="mt-8 rounded-lg border border-border/40 bg-muted/20 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
        Disclaimer
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {STANDARD_DISCLAIMER}
      </p>
    </div>
  );
}
