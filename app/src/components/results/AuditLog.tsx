"use client";

import type { AnalyzeEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useEffect } from "react";

interface AuditLogProps {
  events: AnalyzeEvent[];
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Data Provenance viewer — shows live MCP tool calls to prove
 * Fidelio uses real, verifiable data sources. This is the
 * "institutional-grade audit trail" differentiator.
 */
export function AuditLog({ events, isOpen, onToggle }: AuditLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new events arrive
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, isOpen]);

  const relevantEvents = events.filter(
    (e) =>
      e.type === "status" ||
      e.type === "tool_call" ||
      e.type === "tool_result" ||
      e.type === "error",
  );

  if (relevantEvents.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-7 py-3.5 flex items-center justify-between text-left hover:bg-foreground/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-forest animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Data Provenance
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
            {relevantEvents.length} events
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {isOpen ? "▲ Hide" : "Audit Trail ↓"}
        </span>
      </button>

      {isOpen && (
        <ScrollArea className="h-48 border-t border-border/30">
          <div ref={scrollRef} className="px-4 py-3 font-mono text-[11px] space-y-1">
            {relevantEvents.map((event, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground/50 shrink-0 w-8 text-right">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {event.type === "status" && (
                  <span className="text-gold">
                    ● {event.message}
                  </span>
                )}
                {event.type === "tool_call" && (
                  <span className="text-gold-soft">
                    → {event.tool}({JSON.stringify(event.input)})
                  </span>
                )}
                {event.type === "tool_result" && (
                  <span className={cn("text-forest truncate")}>
                    ← {event.tool}: {typeof event.result === "string" ? event.result : JSON.stringify(event.result).slice(0, 120)}
                  </span>
                )}
                {event.type === "error" && (
                  <span className="text-oxblood">
                    ✕ {event.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
