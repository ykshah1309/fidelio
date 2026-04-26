# Fidelio — app boilerplate

Pre-hackathon scaffolding for the [Claude Builder Club Spring 2026 Hackathon](https://luma.com/0vy2g31t) @ NJIT on Sunday 2026-04-26.

**This is boilerplate only.** No product flow is wired yet — that's the Sunday build, guided by [../BUILD_PLAN.md](../BUILD_PLAN.md).

## What's in here

| Path | Status | Purpose |
|---|---|---|
| `package.json` | boilerplate | Next.js 15 + React 19 + Tailwind + shadcn deps, Claude SDK, MCP SDK |
| `src/app/page.tsx` | placeholder | Shows "bootstrap works" until Sunday; replace entirely during T+2:00–T+5:00 |
| `src/app/api/ping/route.ts` | throwaway | Confirms `ANTHROPIC_API_KEY` flows through on Vercel. Delete after `/api/analyze` is live. |
| `src/lib/prompts.ts` | **production** | Every prompt Fidelio uses. Locked Friday. Do not paraphrase on Sunday. |
| `src/lib/types.ts` | **production** | Zod schemas for extraction + report. Validate every Claude JSON output against these before rendering. |
| `src/lib/fund-data.json` | **production** | 27 common 401(k) holdings with expense ratios — the fallback when a statement doesn't list a ratio. |
| `src/lib/fund-lookup.ts` | **production** | Typed reader + MCP-style tool definition (`lookup_fund_expense_ratio`). |
| `src/lib/claude.ts` | **production** | Anthropic SDK singleton + JSON-tag extraction helpers. |
| `src/lib/mcp.ts` | stub | MCP bridge interface — concrete wire-up happens Sunday T+0:30. |
| `src/lib/utils.ts` | **production** | `cn()` + USD/percent formatters + fee-compounding projection. |
| `scripts/mcp-smoketest.ts` | **throwaway** | Wednesday sanity check that `npx -y financial-hub-mcp` responds over stdio. Delete after it passes. |
| `samples/gold-report-401k.json` | fallback | Pre-constructed report for the 401(k) flow — loaded on the Results page if live extraction fails on stage. |
| `samples/gold-report-paystub.json` | fallback | Same, for the paystub flow. |
| `samples/SAMPLE_PDFS.md` | checklist | Instructions for acquiring the two test PDFs by Thursday evening. |
| `public/samples/` | empty | Drop your real-or-redacted PDFs here. `.gitignore`d so PII never hits GitHub. |
| `src/components/ui/` | empty | `shadcn@latest add ...` drops components here Tuesday. |

## First boot

```bash
cd Fidelio/app
npm install
cp .env.example .env.local       # then fill in the keys
npm run dev
```

- Visit `http://localhost:3000/` — should see the placeholder landing page.
- Visit `http://localhost:3000/api/ping` — should see `{ "ok": true, "reply": "pong", ... }`.

If either fails: fix now, not Sunday.

## Hackathon-day rule

Everything in `src/lib/` is locked code from Saturday night. **On Sunday, write only inside `src/app/` and `src/components/`.** If you catch yourself editing prompts, types, or fund data mid-hackathon, stop and re-read [../PROMPTS.md](../PROMPTS.md) first.

## What you still owe before Saturday

See [../PREP_STATUS.md](../PREP_STATUS.md) for the live checklist.
