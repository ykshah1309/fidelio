# Fidelio

> **Your 401(k) is trying to tell you something. Fidelio translates.**

Drop a PDF. Claude reads it. You find out — in plain English — exactly how much you're bleeding to fees, whether your funds match your paycheck, and the one thing to do about it this week.

Built in 10 hours at **Claude Builder Club @ NJIT · April 26, 2026**.

---

## The problem

The average American pays **$138,000 in unnecessary 401(k) fees over a lifetime** and has no idea. Plan statements are designed to be unreadable. Fund names sound sophisticated. Expense ratios hide behind three decimal points. Your employer match might be leaving money on the table right now and you'd never know from the PDF.

Fidelio fixes that in 30 seconds.

---

## What it does

```
Upload 401(k) statement or paystub  →  Claude reads it  →  You get a plain-English report
```

**The report tells you:**

| Section | What you learn |
|---|---|
| 🏆 **Score** | 0–100 financial health score with a one-sentence verdict |
| 📰 **Headline** | The single most important insight from your document |
| 📊 **Holdings** | Every fund you own, its expense ratio vs. cheaper alternatives |
| 💸 **Fee Impact** | Exact dollar amount you'll lose over 10, 20, 30 years at current fees |
| 🎯 **Match Analysis** | Whether your contribution captures 100% of the employer match |
| 📋 **Paystub Breakdown** | Pre-tax savings rate, effective take-home, contribution gaps |
| ✅ **Action Items** | Ranked, specific steps — "switch VFIAX for FXAIX and save $34/year" |
| 🤖 **AI Chat** | Ask follow-up questions about your specific situation |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | SSR + streaming API routes |
| **AI** | Claude Sonnet 4.6 | PDF vision, tool use, structured output |
| **Data** | Finnhub · FRED · SEC EDGAR via MCP | Live fund prices, macro rates, expense ratio validation |
| **UI** | Tailwind CSS v3 + shadcn/ui | Dark-first, print-ready |
| **Streaming** | Server-Sent Events | Real-time analysis progress |

---

## Architecture

```
User uploads PDF
      │
      ▼
/api/analyze  (SSE stream)
      │
      ├─ Claude: extract structured data from PDF
      │   └─ JSON: funds, contributions, employer match, paystub fields
      │
      ├─ MCP Tools: enrich with live market data
      │   ├─ fund_lookup(ticker) → expense ratio, category, AUM
      │   ├─ get_interest_rate() → current risk-free rate (FRED)
      │   └─ sec_fund_search(name) → SEC filing expense ratio
      │
      └─ Claude: generate report
          └─ JSON: score, headline, holdings[], fee_impact, action_items[]
              │
              ▼
        /api/chat  (SSE stream)
        Claude answers follow-up questions with full report context
```

---

## Getting started

```bash
# 1. Clone
git clone https://github.com/ykshah1309/fidelio.git
cd fidelio/app

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, FINNHUB_API_KEY, FRED_API_KEY, SEC_USER_AGENT_EMAIL

# 4. Run
npm run dev
# → http://localhost:3000
```

**Required env vars:**

| Variable | Get it from |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `ANTHROPIC_FREE_MODEL` | Optional — defaults to `claude-haiku-4-5-20251001` for cheap calls |
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) — free tier works |
| `FRED_API_KEY` | [fred.stlouisfed.org/docs/api](https://fred.stlouisfed.org/docs/api/api_key.html) — free |
| `SEC_USER_AGENT_EMAIL` | Any valid email (SEC EDGAR requirement) |

---

## Why every judge has skin in the game

The 401(k) fee problem is not abstract. It hits every salaried employee in America:

- A **1% fee difference** compounds to **$84,500 lost** on a $50k salary over 30 years
- **43% of workers** don't know their plan's expense ratios (Vanguard, 2024)
- The average plan charges **0.45% more than necessary** (BrightScope data)
- Employer match capture rates average **77%** — 23% of free money left on the table

Fidelio makes the invisible visible. In 30 seconds.

---

## Demo

**Try the sample flows (no upload required):**
- Click **"Sample 401(k)"** — see fee analysis on a realistic plan with high-cost funds
- Click **"Sample Paystub"** — see contribution gap analysis and match optimization

**Then try your own** — your statement never leaves your browser session. Nothing is stored.

---

## Project structure

```
app/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main UI — upload → analyze → report
│   │   └── api/
│   │       ├── analyze/route.ts  # SSE stream: extract + enrich + report
│   │       ├── chat/route.ts     # SSE stream: follow-up chat
│   │       └── gold/route.ts     # Pre-generated sample reports
│   ├── components/
│   │   ├── results/              # Report cards (Score, Holdings, Fees, etc.)
│   │   └── chat/ChatBox.tsx      # Streaming AI chat with markdown rendering
│   └── lib/
│       ├── claude.ts             # Anthropic SDK singleton
│       ├── mcp.ts                # MCP client — Finnhub, FRED, SEC tools
│       ├── prompts.ts            # System + extraction + analysis prompts
│       └── types.ts              # Shared TypeScript types
└── samples/
    ├── gold-report-401k.json     # Pre-generated demo report (401k)
    └── gold-report-paystub.json  # Pre-generated demo report (paystub)
```

---

## Built by

**Yaksh Shah** — Claude Builder Club · Spring 2026 Hackathon  
Track: Economic Empowerment & Education

---

*"Fidelio" — from Latin fidelis, faithful. A faithful reader of documents you shouldn't have to decode yourself.*
