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
    <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-muted-foreground">
            Data Provenance
          </span>
          <span className="text-xs text-muted-foreground/60">
            {relevantEvents.length} events
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {isOpen ? "▲ Hide" : "How Fidelio got this data ↓"}
        </span>
      </button>

      {isOpen && (
        <ScrollArea className="h-48 border-t border-border/30">
          <div ref={scrollRef} className="px-4 py-2 font-mono text-xs space-y-1">
            {relevantEvents.map((event, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground/50 shrink-0 w-8 text-right">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {event.type === "status" && (
                  <span className="text-sky-400">
                    ● {event.message}
                  </span>
                )}
                {event.type === "tool_call" && (
                  <span className="text-amber-400">
                    → {event.tool}({JSON.stringify(event.input)})
                  </span>
                )}
                {event.type === "tool_result" && (
                  <span className={cn("text-emerald-400 truncate")}>
                    ← {event.tool}: {typeof event.result === "string" ? event.result : JSON.stringify(event.result).slice(0, 120)}
                  </span>
                )}
                {event.type === "error" && (
                  <span className="text-rose-400">
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
