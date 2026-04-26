/**
 * Narrator — drips human-sounding status beats with jittered intervals so the
 * loading screen feels alive even while Claude is grinding through one big
 * inference. Real progress events (tool_call, extraction, etc.) interleave;
 * this just keeps the river flowing during the quiet stretches.
 *
 * Usage:
 *   const n = new Narrator((s) => send({ type: "status", message: s }));
 *   n.play(EXTRACTION_BEATS);
 *   // ... do real work ...
 *   n.shift(ANALYSIS_BEATS);  // swap remaining queue
 *   n.stop();                  // when real result lands
 */

type Sender = (message: string) => void;

interface PlayOptions {
  /** Delay before the first beat fires (ms). */
  initialDelayMs?: number;
  /** Minimum interval between beats (ms). */
  minIntervalMs?: number;
  /** Maximum interval between beats (ms). Random jitter between min..max. */
  maxIntervalMs?: number;
}

export class Narrator {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: string[] = [];
  private opts: Required<PlayOptions> = {
    initialDelayMs: 400,
    minIntervalMs: 1300,
    maxIntervalMs: 2400,
  };

  constructor(private readonly send: Sender) {}

  /** Start dripping a fresh queue. Replaces any in-flight playback. */
  play(messages: string[], opts: PlayOptions = {}): void {
    this.stop();
    this.opts = { ...this.opts, ...opts };
    this.queue = [...messages];
    this.timer = setTimeout(() => this.tick(), this.opts.initialDelayMs);
  }

  /** Replace the remaining queue without changing pacing. */
  shift(messages: string[]): void {
    this.queue = [...messages];
  }

  /** Append messages to the existing queue. */
  enqueue(messages: string[]): void {
    this.queue.push(...messages);
  }

  /** Stop and clear. Idempotent. */
  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
  }

  private tick(): void {
    const msg = this.queue.shift();
    if (!msg) {
      this.timer = null;
      return;
    }
    this.send(msg);
    const { minIntervalMs, maxIntervalMs } = this.opts;
    const delay = minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs);
    this.timer = setTimeout(() => this.tick(), delay);
  }
}

// ─── Beat libraries ───────────────────────────────────────────────────────────
// Phrasings deliberately specific to the work each phase does, so they read
// like a thoughtful analyst rather than a spinner. Keep them short — they
// flash by in 1.5–2s windows.

export const EXTRACTION_BEATS = [
  "Scanning document structure…",
  "Identifying account type…",
  "Reading balances and contributions…",
  "Cataloging your fund holdings…",
  "Spotting expense ratios on the page…",
  "Pulling employer match terms…",
];

export const TOOL_BEATS = [
  "Cross-referencing fund database…",
  "Pulling live expense ratios…",
  "Looking up index-fund benchmarks…",
  "Verifying tickers against SEC filings…",
];

export const ANALYSIS_BEATS = [
  "Computing fee compounding to year 30…",
  "Comparing your funds to low-cost equivalents…",
  "Quantifying the dollar impact…",
  "Ranking action items by what saves the most…",
  "Drafting your headline…",
  "Writing your three things to do this week…",
];

export const PAYSTUB_BEATS = [
  "Parsing your deductions…",
  "Checking withholding against income…",
  "Spotting the retirement contribution…",
  "Computing your effective take-home rate…",
];
