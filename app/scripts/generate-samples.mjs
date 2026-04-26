/**
 * Generate sample 401(k) statement and paystub PDFs into public/samples/.
 *
 * Hand-rolled PDF emitter (no deps) — produces text-based PDFs that Claude
 * can read directly. Layout is utilitarian, not pretty; what matters is that
 * the text content is realistic enough to exercise extraction.
 *
 * Run:  node scripts/generate-samples.mjs
 * Out:  public/samples/sample-401k.pdf
 *       public/samples/sample-paystub.pdf
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..");
const OUT_DIR = join(APP_ROOT, "public", "samples");

// ─── Minimal PDF emitter ───────────────────────────────────────────────────

function escapePdfString(s) {
  // Replace non-ASCII en-dash, em-dash, smart quotes with ASCII so
  // WinAnsi-encoded Helvetica renders them correctly.
  return s
    .replace(/–|—/g, "-")
    .replace(/‘|’/g, "'")
    .replace(/“|”/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Build a content stream from a list of text commands.
 * Each cmd = { x, y, text, size?, font? } where font is "F1" | "F2".
 */
function buildContentStream(cmds) {
  let s = "";
  for (const cmd of cmds) {
    const size = cmd.size ?? 10;
    const font = cmd.font ?? "F1";
    s += `BT\n/${font} ${size} Tf\n${cmd.x} ${cmd.y} Td\n(${escapePdfString(cmd.text)}) Tj\nET\n`;
  }
  return s;
}

/**
 * Assemble a multi-page PDF from a list of pages (each page is a list of
 * text commands).
 */
function assemblePdf(pages) {
  // Reserve fixed object IDs:
  //   1 = Catalog, 2 = Pages, 3 = Helvetica (F1), 4 = Helvetica-Bold (F2)
  const catalogId = 1;
  const pagesId = 2;
  const fontRegularId = 3;
  const fontBoldId = 4;
  let nextId = 5;

  const pageData = pages.map((cmds) => {
    const pageId = nextId++;
    const contentId = nextId++;
    return { pageId, contentId, cmds };
  });

  const objs = []; // 1-indexed; objs[i] is the object body string

  objs[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  const kids = pageData.map((p) => `${p.pageId} 0 R`).join(" ");
  objs[pagesId] = `<< /Type /Pages /Kids [${kids}] /Count ${pageData.length} >>`;
  objs[fontRegularId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objs[fontBoldId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  for (const { pageId, contentId, cmds } of pageData) {
    objs[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] ` +
      `/Contents ${contentId} 0 R ` +
      `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`;
    const stream = buildContentStream(cmds);
    const len = Buffer.byteLength(stream, "binary");
    objs[contentId] = `<< /Length ${len} >>\nstream\n${stream}\nendstream`;
  }

  // Serialize with byte-accurate offsets
  const parts = [];
  let cursor = 0;
  function push(s) {
    parts.push(s);
    cursor += Buffer.byteLength(s, "binary");
  }

  push("%PDF-1.4\n");
  push("%\xC1\xC2\xC3\xC4\n"); // binary marker

  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    if (!objs[i]) continue;
    offsets[i] = cursor;
    push(`${i} 0 obj\n${objs[i]}\nendobj\n`);
  }

  const xrefOffset = cursor;
  const objCount = objs.length; // last id + 1 for the free object
  push("xref\n");
  push(`0 ${objCount}\n`);
  push("0000000000 65535 f \n");
  for (let i = 1; i < objCount; i++) {
    const off = offsets[i] ?? 0;
    push(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  push("trailer\n");
  push(`<< /Size ${objCount} /Root ${catalogId} 0 R >>\n`);
  push("startxref\n");
  push(`${xrefOffset}\n`);
  push("%%EOF\n");

  return Buffer.from(parts.join(""), "binary");
}

// ─── Layout helpers ────────────────────────────────────────────────────────

class PageBuilder {
  constructor(opts = {}) {
    this.cmds = [];
    this.x = opts.x ?? 54;
    this.y = opts.y ?? 760;
    this.lineHeight = opts.lineHeight ?? 14;
    this.size = opts.size ?? 10;
  }

  newline(n = 1) {
    this.y -= this.lineHeight * n;
    return this;
  }

  heading(text, size = 16) {
    this.cmds.push({ x: this.x, y: this.y, text, size, font: "F2" });
    this.y -= size + 4;
    return this;
  }

  subheading(text, size = 12) {
    this.cmds.push({ x: this.x, y: this.y, text, size, font: "F2" });
    this.y -= size + 4;
    return this;
  }

  text(text, opts = {}) {
    const size = opts.size ?? this.size;
    const font = opts.font ?? "F1";
    const x = opts.x ?? this.x;
    this.cmds.push({ x, y: this.y, text, size, font });
    if (!opts.same) this.y -= this.lineHeight;
    return this;
  }

  /** Two-column row: left label, right value at fixed x. */
  row(left, right, rightX = 480, opts = {}) {
    const size = opts.size ?? this.size;
    const font = opts.font ?? "F1";
    this.cmds.push({ x: this.x, y: this.y, text: left, size, font });
    this.cmds.push({ x: rightX, y: this.y, text: right, size, font });
    this.y -= this.lineHeight;
    return this;
  }

  /** Multi-column row at given x positions. */
  cols(values, xs, opts = {}) {
    const size = opts.size ?? this.size;
    const font = opts.font ?? "F1";
    for (let i = 0; i < values.length; i++) {
      this.cmds.push({ x: xs[i], y: this.y, text: String(values[i]), size, font });
    }
    this.y -= this.lineHeight;
    return this;
  }

  build() {
    return this.cmds;
  }
}

// ─── Content: 401(k) statement ─────────────────────────────────────────────

function build401kPdf() {
  const p = new PageBuilder();

  p.heading("NORTHFIELD CAPITAL ADVISORS", 18);
  p.text("401(k) Retirement Plan - Quarterly Statement", { size: 11, font: "F2" });
  p.newline();

  p.text("Statement Period: January 1, 2026 - March 31, 2026");
  p.text("Account Number: XXXX-XXXX-1234");
  p.text("Plan Name: Sample Co. 401(k) Savings Plan");
  p.text("Participant: REDACTED");
  p.newline();

  p.subheading("ACCOUNT SUMMARY");
  p.row("Beginning Balance (Jan 1, 2026)", "$79,210.45");
  p.row("Contributions This Period", "$3,070.00");
  p.row("Investment Earnings", "$5,169.87");
  p.row("Total Account Balance (Mar 31, 2026)", "$87,450.32", 480, { font: "F2" });
  p.newline();

  p.subheading("YEAR-TO-DATE CONTRIBUTIONS");
  p.row("Employee Pre-Tax Contributions", "$4,250.00");
  p.row("Employer Match", "$1,890.00");
  p.row("Total YTD Contributions", "$6,140.00", 480, { font: "F2" });
  p.newline();

  p.subheading("INVESTMENT HOLDINGS");
  // Column header
  p.cols(
    ["Fund Name", "Ticker", "Balance", "Allocation", "Exp Ratio"],
    [54, 280, 340, 420, 500],
    { font: "F2" },
  );
  p.cols(
    ["Vanguard Target Retirement 2060", "VTTSX", "$52,470.19", "60.0%", "0.08%"],
    [54, 280, 340, 420, 500],
  );
  p.cols(
    ["Fidelity 500 Index Fund", "FXAIX", "$17,490.06", "20.0%", "0.015%"],
    [54, 280, 340, 420, 500],
  );
  p.cols(
    ["American Funds Growth Fund of America", "AGTHX", "$13,117.55", "15.0%", "0.62%"],
    [54, 280, 340, 420, 500],
  );
  p.cols(
    ["JPMorgan Emerging Markets Equity Fund", "JEMSX", "$4,372.52", "5.0%", "0.92%"],
    [54, 280, 340, 420, 500],
  );
  p.newline();

  p.subheading("EMPLOYER MATCH DETAILS");
  p.text("Match Formula: 100% of the first 3% of pay, plus 50% of the next 2%");
  p.text("Maximum Employer Match Cap: 5% of eligible compensation");
  p.text("Your Current Contribution Rate: 5% of eligible pay");
  p.text("Estimated Annual Employer Match (full capture): $7,560.00");
  p.newline();

  p.subheading("CONTRIBUTION DETAILS");
  p.row("Per-Pay-Period Employee Contribution", "$327.00");
  p.row("Estimated Annual Employee Contribution", "$8,502.00");
  p.row("Vesting Status", "100% Vested");
  p.newline();

  p.subheading("INVESTMENT PERFORMANCE (Year-to-Date)");
  p.row("Account Total Return", "+5.83%");
  p.row("S&P 500 Benchmark", "+6.12%");
  p.newline();

  p.text("This is a sample document for testing purposes only.", { size: 8 });
  p.text("All names and figures are fictional.", { size: 8 });

  return assemblePdf([p.build()]);
}

// ─── Content: Paystub ──────────────────────────────────────────────────────

function buildPaystubPdf() {
  const p = new PageBuilder();

  p.heading("SAMPLE EMPLOYER, INC.", 18);
  p.text("Earnings Statement", { size: 12, font: "F2" });
  p.newline();

  p.row("Pay Period:", "April 1, 2026 - April 15, 2026");
  p.row("Pay Date:", "April 22, 2026");
  p.row("Employee:", "REDACTED");
  p.row("Employee ID:", "XXX-XX-5678");
  p.row("Pay Frequency:", "Bi-weekly");
  p.newline();

  p.subheading("EARNINGS");
  p.cols(
    ["Description", "Hours", "Rate", "Current", "YTD"],
    [54, 220, 290, 380, 480],
    { font: "F2" },
  );
  p.cols(
    ["Regular Salary", "80.00", "$48.0769", "$3,846.15", "$30,769.20"],
    [54, 220, 290, 380, 480],
  );
  p.cols(
    ["Overtime", "0.00", "$72.1153", "$0.00", "$1,442.31"],
    [54, 220, 290, 380, 480],
  );
  p.cols(
    ["Bonus", "-", "-", "$0.00", "$5,000.00"],
    [54, 220, 290, 380, 480],
  );
  p.cols(
    ["Gross Pay", "", "", "$3,846.15", "$37,211.51"],
    [54, 220, 290, 380, 480],
    { font: "F2" },
  );
  p.newline();

  p.subheading("PRE-TAX DEDUCTIONS");
  p.cols(["Description", "Current", "YTD"], [54, 380, 480], { font: "F2" });
  p.cols(["401(k) Contribution (5%)", "$192.31", "$1,860.58"], [54, 380, 480]);
  p.cols(["Health Insurance Premium", "$145.00", "$1,450.00"], [54, 380, 480]);
  p.cols(["Dental Insurance", "$18.50", "$185.00"], [54, 380, 480]);
  p.cols(["HSA Contribution", "$50.00", "$500.00"], [54, 380, 480]);
  p.newline();

  p.subheading("TAXES");
  p.cols(["Description", "Current", "YTD"], [54, 380, 480], { font: "F2" });
  p.cols(["Federal Income Tax", "$462.30", "$4,465.38"], [54, 380, 480]);
  p.cols(["Social Security (FICA)", "$238.46", "$2,307.11"], [54, 380, 480]);
  p.cols(["Medicare", "$55.77", "$539.57"], [54, 380, 480]);
  p.cols(["State Income Tax (NJ)", "$176.92", "$1,711.73"], [54, 380, 480]);
  p.newline();

  p.subheading("EMPLOYER CONTRIBUTIONS (informational)");
  p.cols(["Description", "Current", "YTD"], [54, 380, 480], { font: "F2" });
  p.cols(["401(k) Employer Match (3% of pay)", "$115.38", "$1,116.35"], [54, 380, 480]);
  p.cols(["Health Insurance (employer share)", "$245.00", "$2,450.00"], [54, 380, 480]);
  p.newline();

  p.subheading("NET PAY");
  p.row("Current Net Pay", "$2,506.89", 480, { font: "F2", size: 12 });
  p.row("Year-to-Date Net Pay", "$24,192.14", 480, { font: "F2" });
  p.newline();

  p.subheading("DIRECT DEPOSIT");
  p.row("Checking Account XXXX-9012", "$2,506.89");
  p.newline();

  p.subheading("BENEFITS SUMMARY");
  p.text("Annualized Salary Estimate: $100,000.00");
  p.text("Match Formula: 100% of first 3% contributed + 50% of next 2%");
  p.text("Match Cap: 5% of eligible compensation");
  p.newline();

  p.text("This is a sample document for testing purposes only.", { size: 8 });
  p.text("All names and figures are fictional.", { size: 8 });

  return assemblePdf([p.build()]);
}

// ─── Run ───────────────────────────────────────────────────────────────────

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const k = build401kPdf();
const ps = buildPaystubPdf();

const path401k = join(OUT_DIR, "sample-401k.pdf");
const pathPaystub = join(OUT_DIR, "sample-paystub.pdf");

writeFileSync(path401k, k);
writeFileSync(pathPaystub, ps);

console.log(`wrote ${path401k} (${k.length} bytes)`);
console.log(`wrote ${pathPaystub} (${ps.length} bytes)`);
