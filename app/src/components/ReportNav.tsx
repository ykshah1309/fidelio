"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "score", label: "Score" },
  { id: "headline", label: "Summary" },
  { id: "holdings", label: "Holdings" },
  { id: "fees", label: "Fees" },
  { id: "match", label: "Match" },
  { id: "paystub", label: "Paystub" },
  { id: "actions", label: "Actions" },
  { id: "chat", label: "Ask" },
];

export function ReportNav() {
  const [active, setActive] = useState<string>("score");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const ids = NAV_ITEMS.map((n) => n.id);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    }
  }

  // Only show nav items whose sections exist in the DOM
  const [visibleItems, setVisibleItems] = useState<NavItem[]>(NAV_ITEMS);
  useEffect(() => {
    setVisibleItems(NAV_ITEMS.filter((n) => !!document.getElementById(n.id)));
  }, []);

  if (visibleItems.length < 3) return null;

  const activeItem = visibleItems.find((n) => n.id === active) ?? visibleItems[0];

  return (
    <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/40 -mx-6 px-6 mb-8" data-print-hide>
      {/* Active section breadcrumb */}
      <div className="flex items-center gap-2 pt-2 pb-0.5">
        <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">Viewing</span>
        <span className="font-mono text-[10px] font-semibold text-gold uppercase tracking-widest">— {activeItem.label}</span>
      </div>
      <nav className="overflow-x-auto scrollbar-none">
        <ul className="flex gap-1 py-1.5 min-w-max">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => scrollTo(item.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors whitespace-nowrap",
                  active === item.id
                    ? "bg-gold/10 text-gold"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
