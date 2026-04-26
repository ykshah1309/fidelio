"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "fidelio-panel-layout-v2";
/** Pixels of horizontal drag required to increment/decrement column span */
const COL_STEP_PX = 120;
/** Pixels of vertical drag required to increment/decrement row span */
const ROW_STEP_PX = 80;

// ── Types ─────────────────────────────────────────────────────────────────────

type ColSpan = 1 | 2 | 3;
type RowSpan = 1 | 2 | 3 | 4;

interface PanelState {
  id: string;
  colSpan: ColSpan;
  rowSpan: RowSpan;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_PANELS: PanelState[] = [
  { id: "score",    colSpan: 3, rowSpan: 2 },
  { id: "headline", colSpan: 3, rowSpan: 2 },
  { id: "holdings", colSpan: 3, rowSpan: 4 },
  { id: "fees",     colSpan: 3, rowSpan: 3 },
  { id: "match",    colSpan: 1, rowSpan: 2 },
  { id: "paystub",  colSpan: 2, rowSpan: 2 },
  { id: "actions",  colSpan: 3, rowSpan: 3 },
  { id: "audit",    colSpan: 3, rowSpan: 2 },
  { id: "chat",     colSpan: 3, rowSpan: 4 },
];

// Full Tailwind class names — must be string literals for JIT to include them
const COL_CLASS: Record<ColSpan, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
};
const ROW_CLASS: Record<RowSpan, string> = {
  1: "row-span-1",
  2: "row-span-2",
  3: "row-span-3",
  4: "row-span-4",
};

// ── Storage ───────────────────────────────────────────────────────────────────

function loadPanels(): PanelState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PANELS;
    const arr = JSON.parse(raw) as PanelState[];
    if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_PANELS;
    return arr;
  } catch {
    return DEFAULT_PANELS;
  }
}

function savePanels(panels: PanelState[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(panels)); } catch { /* ignore */ }
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────

interface WrapperProps {
  id: string;
  colSpan: ColSpan;
  rowSpan: RowSpan;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (id: string) => void;
  onDragOver:  (id: string) => void;
  onDrop:      (fromId: string, toId: string) => void;
  onDragEnd:   () => void;
  onColSpan:   (id: string, next: ColSpan) => void;
  onRowSpan:   (id: string, next: RowSpan) => void;
  children: ReactNode;
}

function PanelWrapper({
  id, colSpan, rowSpan, isDragging, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onColSpan, onRowSpan,
  children,
}: WrapperProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Column resize (right edge drag) ───────────────────────────────────────
  const startColResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX    = e.clientX;
      const startSpan = colSpan;
      const onMove = (me: MouseEvent) => {
        const d = me.clientX - startX;
        const delta = d > 0 ? Math.floor(d / COL_STEP_PX) : Math.ceil(d / COL_STEP_PX);
        const next = Math.max(1, Math.min(3, startSpan + delta)) as ColSpan;
        onColSpan(id, next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [colSpan, id, onColSpan],
  );

  // ── Row resize (bottom edge drag) ─────────────────────────────────────────
  const startRowResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startY    = e.clientY;
      const startSpan = rowSpan;
      const onMove = (me: MouseEvent) => {
        const d = me.clientY - startY;
        const delta = d > 0 ? Math.floor(d / ROW_STEP_PX) : Math.ceil(d / ROW_STEP_PX);
        const next = Math.max(1, Math.min(4, startSpan + delta)) as RowSpan;
        onRowSpan(id, next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [rowSpan, id, onRowSpan],
  );

  return (
    <div
      ref={panelRef}
      className={[
        "relative group transition-all duration-150",
        COL_CLASS[colSpan],
        ROW_CLASS[rowSpan],
        isDragging  ? "opacity-40 scale-[0.98]" : "",
        isDragOver  ? "ring-2 ring-amber-500/60 ring-inset rounded-xl" : "",
      ].join(" ")}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData("text/plain");
        onDrop(fromId, id);
      }}
    >
      {/* ── Drag handle (top bar) ── */}
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData("text/plain", id);
          e.dataTransfer.effectAllowed = "move";
          // Use the full panel as the drag ghost image
          if (panelRef.current) {
            e.dataTransfer.setDragImage(
              panelRef.current,
              Math.round(panelRef.current.offsetWidth / 2),
              20,
            );
          }
          onDragStart(id);
        }}
        onDragEnd={onDragEnd}
        className="absolute top-0 inset-x-0 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-20 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <svg className="h-3 w-4 text-muted-foreground/50" fill="currentColor" viewBox="0 0 20 8">
          <circle cx="3"  cy="2" r="1.5" />
          <circle cx="10" cy="2" r="1.5" />
          <circle cx="17" cy="2" r="1.5" />
          <circle cx="3"  cy="6" r="1.5" />
          <circle cx="10" cy="6" r="1.5" />
          <circle cx="17" cy="6" r="1.5" />
        </svg>
      </div>

      {/* ── Panel content ── */}
      <div className="h-full overflow-auto">{children}</div>

      {/* ── Right edge: column-span resize handle ── */}
      <div
        onMouseDown={startColResize}
        className="absolute right-0 top-6 bottom-4 w-3 cursor-ew-resize z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to resize width"
      >
        <div className="w-0.5 h-8 bg-muted-foreground/30 rounded-full" />
      </div>

      {/* ── Bottom edge: row-span resize handle ── */}
      <div
        onMouseDown={startRowResize}
        className="absolute bottom-0 inset-x-4 h-3 cursor-ns-resize z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to resize height"
      >
        <div className="h-0.5 w-8 bg-muted-foreground/30 rounded-full" />
      </div>
    </div>
  );
}

// ── DashboardGrid ─────────────────────────────────────────────────────────────

export interface DashboardGridProps {
  score:    ReactNode;
  headline: ReactNode;
  holdings: ReactNode;
  fees:     ReactNode;
  match:    ReactNode;
  paystub:  ReactNode;
  actions:  ReactNode;
  audit:    ReactNode;
  chat:     ReactNode;
}

export function DashboardGrid(props: DashboardGridProps) {
  const nodes = props as unknown as Record<string, ReactNode>;

  const [panels, setPanels] = useState<PanelState[]>(() =>
    typeof window !== "undefined" ? loadPanels() : DEFAULT_PANELS,
  );
  const [dragId,     setDragId]     = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const updatePanels = useCallback((next: PanelState[]) => {
    setPanels(next);
    savePanels(next);
  }, []);

  const handleDragStart = useCallback((id: string) => setDragId(id), []);

  const handleDragOver = useCallback(
    (id: string) => { if (id !== dragId) setDragOverId(id); },
    [dragId],
  );

  const handleDrop = useCallback(
    (fromId: string, toId: string) => {
      setDragId(null);
      setDragOverId(null);
      if (!fromId || fromId === toId) return;
      const next = [...panels];
      const from = next.findIndex((p) => p.id === fromId);
      const to   = next.findIndex((p) => p.id === toId);
      if (from === -1 || to === -1) return;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      updatePanels(next);
    },
    [panels, updatePanels],
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

  const handleColSpan = useCallback((id: string, next: ColSpan) => {
    setPanels((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, colSpan: next } : p));
      savePanels(updated);
      return updated;
    });
  }, []);

  const handleRowSpan = useCallback((id: string, next: RowSpan) => {
    setPanels((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, rowSpan: next } : p));
      savePanels(updated);
      return updated;
    });
  }, []);

  const resetLayout = useCallback(() => updatePanels(DEFAULT_PANELS), [updatePanels]);

  return (
    <div>
      {/* Reset button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={resetLayout}
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors underline-offset-2 hover:underline"
        >
          Reset layout
        </button>
      </div>

      {/*
        CSS grid — 3 equal columns, auto-rows at 140 px each.
        Panels span 1–3 columns and 1–4 rows via Tailwind col-span / row-span
        classes. Drag-to-reorder changes DOM order; resize handles change spans.
      */}
      <div className="grid grid-cols-3 gap-3 auto-rows-[140px]">
        {panels.map(({ id, colSpan, rowSpan }) =>
          nodes[id] ? (
            <PanelWrapper
              key={id}
              id={id}
              colSpan={colSpan}
              rowSpan={rowSpan}
              isDragging={dragId     === id}
              isDragOver={dragOverId === id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onColSpan={handleColSpan}
              onRowSpan={handleRowSpan}
            >
              {nodes[id]}
            </PanelWrapper>
          ) : null,
        )}
      </div>
    </div>
  );
}
