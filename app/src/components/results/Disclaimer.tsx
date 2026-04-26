"use client";

import { STANDARD_DISCLAIMER } from "@/lib/prompts";

export function Disclaimer() {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 px-5 py-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        {STANDARD_DISCLAIMER}
      </p>
    </div>
  );
}
