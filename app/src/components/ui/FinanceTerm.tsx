"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { FINANCE_GLOSSARY } from "@/lib/finance-glossary";
import { cn } from "@/lib/utils";

interface FinanceTermProps {
  term: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a financial term with a Radix portal tooltip so it is never clipped
 * by parent overflow-hidden containers.
 */
export function FinanceTerm({ term, children, className }: FinanceTermProps) {
  const definition = FINANCE_GLOSSARY[term.toLowerCase()];
  if (!definition) return <span className={className}>{children}</span>;

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span
            className={cn(
              "underline decoration-dotted decoration-muted-foreground/40 cursor-help inline",
              className,
            )}
          >
            {children}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            align="center"
            sideOffset={6}
            className={cn(
              "z-[9999] w-56 rounded-lg border border-border bg-popover px-3 py-2.5",
              "text-xs text-popover-foreground leading-relaxed shadow-lg",
              "animate-in fade-in-0 zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            )}
          >
            {definition}
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
