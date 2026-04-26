"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { AnalyzeEvent, Extraction, Report } from "@/lib/types";
import { HeadlineCard } from "@/components/results/HeadlineCard";
import { HoldingsTable } from "@/components/results/HoldingsTable";
import { FeeImpactCard } from "@/components/results/FeeImpactCard";
import { MatchCard } from "@/components/results/MatchCard";
import { ActionItemCard } from "@/components/results/ActionItemCard";
import { AuditLog } from "@/components/results/AuditLog";
import { Disclaimer } from "@/components/results/Disclaimer";
import { ChatBox } from "@/components/chat/ChatBox";
import { ScoreCard } from "@/components/results/ScoreCard";
import { PaystubCard } from "@/components/results/PaystubCard";
import { LoadingState } from "@/components/LoadingState";
import { ReportNav } from "@/components/ReportNav";
import { ThemeToggle } from "@/components/ThemeToggle";

type AppState =
  | { phase: "upload" }
  | { phase: "analyzing"; statusMessage: string; events: AnalyzeEvent[] }
  | {
      phase: "report";
      extraction: Extraction;
      report: Report;
      events: AnalyzeEvent[];
    }
  | { phase: "error"; message: string; events: AnalyzeEvent[] };

/** Detect scanned-image PDF error messages for a user-friendly hint */
function isScannedPdfError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("no text") ||
    lower.includes("scanned") ||
    lower.includes("image-based") ||
    lower.includes("ocr") ||
    lower.includes("couldn't extract") ||
    lower.includes("unable to read") ||
    lower.includes("unreadable")
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>({ phase: "upload" });
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedFileName, setDroppedFileName] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload & analysis flow ─────────────────────────────────────────────────

  const analyzeFile = useCallback(async (file: File) => {
    const events: AnalyzeEvent[] = [];

    setState({ phase: "analyzing", statusMessage: "Uploading…", events });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok || !res.body) {
        setState({
          phase: "error",
          message: `Server error: ${res.status} ${res.statusText}`,
          events,
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let extraction: Extraction | null = null;
      let report: Report | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const json = trimmed.slice(6);

          let event: AnalyzeEvent;
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }

          events.push(event);

          switch (event.type) {
            case "status":
              setState({
                phase: "analyzing",
                statusMessage: event.message,
                events: [...events],
              });
              break;
            case "extraction":
              extraction = event.data;
              break;
            case "report":
              report = event.data;
              break;
            case "error":
              setState({
                phase: "error",
                message: event.message,
                events: [...events],
              });
              return;
            case "tool_call":
            case "tool_result":
              setState((prev) =>
                prev.phase === "analyzing"
                  ? { ...prev, events: [...events] }
                  : prev,
              );
              break;
            case "done":
              break;
          }
        }
      }

      if (extraction && report) {
        setState({
          phase: "report",
          extraction,
          report,
          events: [...events],
        });
      } else {
        setState({
          phase: "error",
          message:
            "Analysis completed but could not generate a complete report. Please try a different document.",
          events: [...events],
        });
      }
    } catch (err) {
      setState({
        phase: "error",
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        events,
      });
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        setDroppedFileName(file.name);
        analyzeFile(file);
      }
    },
    [analyzeFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setDroppedFileName(file.name);
        analyzeFile(file);
      }
    },
    [analyzeFile],
  );

  const loadSample = useCallback(
    async (sampleName: string) => {
      setState({
        phase: "analyzing",
        statusMessage: "Loading sample…",
        events: [],
      });

      try {
        // Try to load live from /api/analyze with a sample PDF
        const res = await fetch(`/samples/${sampleName}`);
        if (!res.ok) throw new Error("Sample not available");
        const blob = await res.blob();
        const file = new File([blob], sampleName, { type: "application/pdf" });
        analyzeFile(file);
      } catch {
        // Fallback to gold report
        const goldFile = sampleName.includes("paystub")
          ? "gold-report-paystub"
          : "gold-report-401k";
        try {
          const goldRes = await fetch(`/api/gold?file=${goldFile}`);
          const goldData = await goldRes.json();
          setState({
            phase: "report",
            extraction: goldData.extraction_input,
            report: goldData.report,
            events: [
              {
                type: "status",
                message: "Loaded pre-generated sample report (demo mode).",
              },
            ],
          });
        } catch {
          // Final fallback: import the JSON directly
          try {
            const goldModule = await import(
              `../../samples/${goldFile}.json`
            );
            const goldData = goldModule.default ?? goldModule;
            setState({
              phase: "report",
              extraction: goldData.extraction_input,
              report: goldData.report,
              events: [
                {
                  type: "status",
                  message: "Loaded pre-generated sample report (demo mode).",
                },
              ],
            });
          } catch {
            setState({
              phase: "error",
              message: "Could not load sample. Please upload your own PDF.",
              events: [],
            });
          }
        }
      }
    },
    [analyzeFile],
  );

  const resetToUpload = useCallback(() => {
    setState({ phase: "upload" });
    setAuditOpen(false);
    setDroppedFileName(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Upload screen
  if (state.phase === "upload") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 relative overflow-hidden">
        {/* Theme toggle — top right */}
        <div className="absolute top-5 right-5">
          <ThemeToggle />
        </div>

        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-amber-500/5 via-transparent to-rose-500/5 blur-3xl" />

        <div className="relative max-w-xl text-center">
          <h1 className="text-5xl sm:text-6xl font-serif leading-tight tracking-tight text-foreground">
            Your 401(k) is trying to tell you something.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Drop the PDF. Claude will translate.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-10 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-all duration-300 ${
              isDragOver
                ? "border-amber-500/60 bg-amber-500/5 scale-[1.02]"
                : "border-border/50 bg-card/30 hover:border-border hover:bg-card/50"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <svg
                className={`h-10 w-10 transition-colors ${
                  isDragOver ? "text-amber-500" : "text-muted-foreground/40"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              {isDragOver ? (
                <p className="text-sm text-amber-400 font-medium">Drop your PDF here</p>
              ) : droppedFileName ? (
                <p className="text-sm text-emerald-400 font-medium">
                  ✓ {droppedFileName} — click to change
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Drag your 401(k) statement or paystub here
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    or click to browse
                  </p>
                </>
              )}
              <p className="text-xs text-muted-foreground/40">
                PDF only · analyzed in memory · nothing is saved
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Sample links — prominent buttons */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">or try a sample — no upload needed</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadSample("sample-401k.pdf")}
                className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                </svg>
                Sample 401(k)
              </button>
              <button
                onClick={() => loadSample("sample-paystub.pdf")}
                className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/30 px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-card/60 hover:border-border hover:text-foreground transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
                Sample Paystub
              </button>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/30 px-4 py-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">Analyzed in memory</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/30 px-4 py-2">
              <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <span className="text-xs text-muted-foreground">No account required</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/30 px-4 py-2">
              <span className="text-xs text-muted-foreground">⚡ Powered by Claude Sonnet 4.6</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Analyzing screen
  if (state.phase === "analyzing") {
    return <LoadingState statusMessage={state.statusMessage} events={state.events} />;
  }

  // Error screen
  if (state.phase === "error") {
    const scanned = isScannedPdfError(state.message);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
        <div className="absolute top-5 right-5"><ThemeToggle /></div>
        <div className="max-w-lg text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-6">
            <svg className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          {scanned ? (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-3">We couldn’t read this PDF</h2>
              <p className="text-muted-foreground leading-relaxed">
                This looks like a scanned or image-based PDF. Fidelio works best with text-based statements — the kind your plan provider emails you or generates in their portal.
              </p>
              <p className="mt-4 text-sm text-muted-foreground/70">
                Try downloading a fresh statement from your 401(k) provider’s website, or use one of our samples below to see what Fidelio can do.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button onClick={() => loadSample("sample-401k.pdf")} variant="outline" size="sm">
                  Try sample 401(k)
                </Button>
                <Button onClick={resetToUpload} size="sm">
                  Upload a different PDF
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {state.message}
              </p>
              <Button onClick={resetToUpload} className="mt-8" variant="outline">
                Try another document
              </Button>
              {state.events.length > 0 && (
                <div className="mt-8">
                  <AuditLog
                    events={state.events}
                    isOpen={auditOpen}
                    onToggle={() => setAuditOpen(!auditOpen)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  // Report screen
  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">
            Your Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Powered by Claude · verified with live market data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            title="Save as PDF"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Save PDF
          </button>
          <Button onClick={resetToUpload} variant="outline" size="sm">
            New document
          </Button>
        </div>
      </div>

      {/* Sticky section nav */}
      <ReportNav />

      {/* Report cards — stacked */}
      <div className="mt-6 space-y-6">
        <ScoreCard report={state.report} extraction={state.extraction} />
        <HeadlineCard headline={state.report.headline} />
        <HoldingsTable holdings={state.report.holdings_review} />
        <FeeImpactCard feeImpact={state.report.fee_impact} />
        <div className="grid sm:grid-cols-2 gap-6">
          <MatchCard matchAnalysis={state.report.match_analysis} />
          <PaystubCard report={state.report} extraction={state.extraction} />
        </div>
        <ActionItemCard actionItems={state.report.action_items} />
        <AuditLog
          events={state.events}
          isOpen={auditOpen}
          onToggle={() => setAuditOpen(!auditOpen)}
        />
        <ChatBox extraction={state.extraction} report={state.report} />
      </div>

      <Disclaimer />
    </main>
  );
}
