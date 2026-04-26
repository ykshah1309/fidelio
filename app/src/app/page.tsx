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
import { HeroTicker } from "@/components/HeroTicker";
import { Reveal } from "@/components/Reveal";

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

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB — well above any real statement

/** Validate a user-uploaded file before sending it to /api/analyze. */
function validatePdfFile(file: File): { ok: true } | { ok: false; message: string } {
  if (file.size === 0) {
    return {
      ok: false,
      message: "That file is empty (0 bytes). Try downloading a fresh copy from your plan provider.",
    };
  }
  if (file.size > MAX_PDF_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      message: `That PDF is ${mb} MB — too large to analyze. Most 401(k) statements are under 5 MB. Try downloading the most recent one only.`,
    };
  }
  // Some browsers leave file.type empty for drag-drop. Fall back to extension.
  const looksLikePdfByType = file.type === "application/pdf";
  const looksLikePdfByName = /\.pdf$/i.test(file.name);
  if (!looksLikePdfByType && !looksLikePdfByName) {
    return {
      ok: false,
      message: `Only PDFs are supported. ${
        file.name ? `"${file.name}" doesn't look like a PDF.` : "That file doesn't look like a PDF."
      } Download a statement directly from your plan provider as a PDF.`,
    };
  }
  return { ok: true };
}

export default function Home() {
  const [state, setState] = useState<AppState>({ phase: "upload" });
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedFileName, setDroppedFileName] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload & analysis flow ─────────────────────────────────────────────────

  const analyzeFile = useCallback(async (file: File) => {
    // Validate before kicking off the network call
    const v = validatePdfFile(file);
    if (!v.ok) {
      setState({ phase: "error", message: v.message, events: [] });
      return;
    }

    const events: AnalyzeEvent[] = [];
    setState({ phase: "analyzing", statusMessage: "Uploading…", events });

    // Force PDF MIME type — browsers sometimes hand us "" or
    // "application/octet-stream" for drag-drops, which Anthropic rejects.
    const pdfFile =
      file.type === "application/pdf"
        ? file
        : new File([file], file.name, { type: "application/pdf" });

    const formData = new FormData();
    formData.append("file", pdfFile);

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
        const res = await fetch(`/samples/${sampleName}`);
        if (!res.ok) throw new Error("Sample not available");
        const blob = await res.blob();
        const file = new File([blob], sampleName, { type: "application/pdf" });
        analyzeFile(file);
      } catch {
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
      <main className="relative min-h-screen overflow-hidden">
        {/* Top nameplate bar — editorial */}
        <header className="relative z-20 flex items-center justify-between px-6 sm:px-10 py-5 border-b border-border/40">
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 text-gold" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M12 12L3 7M12 12l9-5M12 12v10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <div className="flex flex-col leading-none">
              <span className="font-serif text-base font-bold tracking-editorial text-foreground">
                Fidelio
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                A Faithful Reader · Vol. I
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            <span className="hidden sm:inline">Built with Claude Sonnet 4.6</span>
            <ThemeToggle />
          </div>
        </header>

        {/* Background ornaments */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-gold/10 via-transparent to-oxblood/5 blur-3xl" />
          <div className="absolute top-24 left-10 h-32 w-32 rounded-full border border-gold/20 animate-spin-slow" />
          <div className="absolute bottom-24 right-10 h-24 w-24 rounded-full border border-oxblood/20 animate-spin-slow" style={{ animationDirection: "reverse" }} />
        </div>

        {/* Hero */}
        <section className="relative z-10 px-6 sm:px-10 pt-16 sm:pt-24 pb-12">
          <div className="mx-auto max-w-3xl text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-gold">
                Spring 2026 · Economic Empowerment
              </span>
            </div>

            {/* Hero headline */}
            <h1 className="mt-8 font-serif text-5xl sm:text-7xl font-bold tracking-editorial leading-[1.02] text-foreground">
              Your 401(k) is{" "}
              <span className="italic text-gold">trying to tell</span>{" "}
              you something.
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Drop the PDF. Claude reads it. You find out — in plain English —
              exactly what you&apos;re paying, what you&apos;re missing, and the one
              thing to do this week.
            </p>

            {/* Live insight ticker */}
            <div className="flex justify-center">
              <HeroTicker />
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-10 group relative rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-300 ${
                isDragOver
                  ? "border-gold bg-gold/10 scale-[1.01]"
                  : "border-border/60 bg-card/30 hover:border-gold/60 hover:bg-card/60"
              }`}
            >
              {/* Decorative corner marks — editorial */}
              <span className="absolute top-2 left-2 h-3 w-3 border-t border-l border-gold/40" />
              <span className="absolute top-2 right-2 h-3 w-3 border-t border-r border-gold/40" />
              <span className="absolute bottom-2 left-2 h-3 w-3 border-b border-l border-gold/40" />
              <span className="absolute bottom-2 right-2 h-3 w-3 border-b border-r border-gold/40" />

              <div className="flex flex-col items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
                  isDragOver ? "bg-gold/20" : "bg-muted/50 group-hover:bg-gold/10"
                }`}>
                  <svg
                    className={`h-6 w-6 transition-colors ${
                      isDragOver ? "text-gold" : "text-muted-foreground/60 group-hover:text-gold"
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
                </div>
                {isDragOver ? (
                  <p className="text-sm text-gold font-medium">Drop your PDF here</p>
                ) : droppedFileName ? (
                  <p className="text-sm text-forest font-medium">
                    ✓ {droppedFileName} — click to change
                  </p>
                ) : (
                  <>
                    <p className="text-base text-foreground font-medium">
                      Drag your 401(k) statement or paystub here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse · PDF only
                    </p>
                  </>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Sample CTAs — branded */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                Or try a sample — no upload needed
              </span>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => loadSample("sample-401k.pdf")}
                  className="group flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-5 py-2.5 text-sm font-medium text-gold hover:bg-gold/20 hover:border-gold transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                  </svg>
                  Sample 401(k) Statement
                </button>
                <button
                  onClick={() => loadSample("sample-paystub.pdf")}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-card/70 hover:border-border hover:text-foreground transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                  Sample Paystub
                </button>
              </div>
            </div>

            {/* Trust strip */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-forest" />
                Analyzed in memory
              </div>
              <span className="h-3 w-px bg-border/60 hidden sm:inline-block" />
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-forest" />
                Nothing stored
              </div>
              <span className="h-3 w-px bg-border/60 hidden sm:inline-block" />
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                Live market data via MCP
              </div>
            </div>
          </div>
        </section>

        {/* Below-the-fold: "What you'll see" preview */}
        <Reveal as="section" className="relative z-10 px-6 sm:px-10 py-20 border-t border-border/40">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                — What you&apos;ll see —
              </span>
              <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-bold tracking-editorial text-foreground">
                A report Wall Street wishes you&apos;d never read.
              </h2>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {[
                {
                  eyebrow: "Score",
                  big: "B+",
                  caption: "Your portfolio, graded.",
                  body: "A 0–100 health score from blended fees, match capture, and diversification.",
                  tone: "text-gold",
                },
                {
                  eyebrow: "Headline",
                  big: "$84,500",
                  caption: "The single most important number.",
                  body: "What you’ll lose to fees over 30 years if nothing changes.",
                  tone: "text-oxblood",
                },
                {
                  eyebrow: "Action",
                  big: "1 thing",
                  caption: "Concrete. Doable. This week.",
                  body: "Not vague advice. A specific switch worth a specific dollar amount.",
                  tone: "text-forest",
                },
              ].map((c, i) => (
                <Reveal key={c.eyebrow} delay={i * 80}>
                  <div className="relative h-full rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-6 hover:border-gold/40 transition-colors">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                      {c.eyebrow}
                    </span>
                    <p className={`mt-3 font-serif text-5xl font-bold tracking-editorial nums ${c.tone}`}>
                      {c.big}
                    </p>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {c.caption}
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                      {c.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Footer */}
        <footer className="relative z-10 border-t border-border/40 px-6 sm:px-10 py-6">
          <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            <span>Fidelio · Latin <em className="font-serif italic">fidelis</em>, faithful</span>
            <span>Built at NJIT Claude Builder Club · 04.26.2026</span>
          </div>
        </footer>
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
          <div className="mx-auto h-12 w-12 rounded-full bg-oxblood/10 flex items-center justify-center mb-6">
            <svg className="h-6 w-6 text-oxblood" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          {scanned ? (
            <>
              <h2 className="font-serif text-2xl font-semibold text-foreground mb-3">We couldn&apos;t read this PDF</h2>
              <p className="text-muted-foreground leading-relaxed">
                This looks like a scanned or image-based PDF. Fidelio works best with text-based statements — the kind your plan provider emails you or generates in their portal.
              </p>
              <p className="mt-4 text-sm text-muted-foreground/70">
                Try downloading a fresh statement from your 401(k) provider&apos;s website, or use one of our samples below to see what Fidelio can do.
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
    <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-4">
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6 text-gold shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M12 12L3 7M12 12l9-5M12 12v10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Fidelio Report · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <h1 className="font-serif text-2xl font-bold tracking-editorial text-foreground leading-tight">
              Your Translation
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-1.5 rounded-md border border-border/60 bg-card/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
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
      <p className="text-sm text-muted-foreground -mt-1">
        Powered by Claude · verified with live market data
      </p>

      {/* Sticky section nav */}
      <ReportNav />

      {/* Report cards — stacked, scroll-revealed */}
      <div className="mt-6 space-y-6">
        <Reveal><ScoreCard report={state.report} extraction={state.extraction} /></Reveal>
        <Reveal delay={50}><HeadlineCard headline={state.report.headline} /></Reveal>
        <Reveal delay={100}><HoldingsTable holdings={state.report.holdings_review} /></Reveal>
        <Reveal delay={50}><FeeImpactCard feeImpact={state.report.fee_impact} /></Reveal>
        <div className="grid sm:grid-cols-2 gap-6">
          <Reveal><MatchCard matchAnalysis={state.report.match_analysis} /></Reveal>
          <Reveal delay={80}><PaystubCard report={state.report} extraction={state.extraction} /></Reveal>
        </div>
        <Reveal><ActionItemCard actionItems={state.report.action_items} /></Reveal>
        <Reveal>
          <AuditLog
            events={state.events}
            isOpen={auditOpen}
            onToggle={() => setAuditOpen(!auditOpen)}
          />
        </Reveal>
        <Reveal><ChatBox extraction={state.extraction} report={state.report} /></Reveal>
      </div>

      <Disclaimer />
    </main>
  );
}
