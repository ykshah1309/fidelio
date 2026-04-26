# Sample PDFs — you still need to acquire these

**Deadline: Thursday April 23 evening.**

Per BUILD_PLAN.md § Thursday, you need two real (or synthesized) PDF documents
to test Fidelio against before Sunday. **This is the single highest-leverage
prep task of the week.** Without real PDFs you cannot verify extraction quality,
and untested prompts on hackathon day are a coin flip.

## What you need

Drop both files into `public/samples/` in the Fidelio app. They are
`.gitignore`-excluded so PII never makes it into the repo.

```
public/samples/sample-401k.pdf
public/samples/sample-paystub.pdf
```

## Where to get them

### 401(k) statement

**Easiest paths, in order of preference:**

1. **Your own.** Log into NetBenefits / Empower / Principal / Vanguard / wherever your plan lives. Download the most recent quarterly statement as PDF. Open it in Preview (macOS) or Acrobat (Windows) and redact your name, account number, SSN, and address — **black out the pixels**, do not just cover with a white rectangle, do not hide a layer. Save as `sample-401k.pdf`.

2. **A family member's**, with permission. Same redaction discipline.

3. **A provider sample.** Vanguard, Fidelity, and Empower publish "example statement" PDFs as part of their help docs. Search:
   - `site:vanguard.com filetype:pdf sample statement`
   - `site:fidelity.com filetype:pdf sample 401(k) statement`
   - `site:empower.com filetype:pdf participant statement`
   These typically have realistic layouts with fictional data — perfect for testing.

4. **Synthetic.** If nothing else works, construct one in Google Docs matching a typical 401(k) statement layout, export as PDF. The downside: you're testing extraction against a layout you invented, not the ones Claude will see in the wild.

**Minimum realism requirements:**
- Lists at least 2 holdings (1 target-date fund + 1 index fund is ideal)
- Has ticker symbols visible
- Lists expense ratios for at least one fund
- Shows a YTD contribution total
- Shows at least one employer match figure

### Paystub

**Easiest paths:**

1. **Your own.** Most payroll portals (ADP, Gusto, Paychex, Workday) let you download a PDF of any paycheck. Download one, redact name / address / employee ID / last 4 of SSN.

2. **A provider sample.** ADP publishes sample paystubs on their help pages for every state. Same with Gusto.

3. **Synthetic.** Paystub Generator sites exist — only use them to understand the layout, then construct your own with plausible numbers.

**Minimum realism requirements:**
- Gross pay, net pay, pay period dates
- At least federal tax, FICA, Medicare, and one pre-tax deduction
- A 401(k) contribution line
- An employer match line (ideally — some paystubs omit this)
- YTD totals

## Redaction checklist (do not skip)

If you use any real document, before saving to `public/samples/`:

- [ ] Name redacted (black rectangle, not a layer)
- [ ] Address redacted
- [ ] Account number redacted
- [ ] Employer name redacted or replaced (*"Anytown Health System"*)
- [ ] SSN (even just the last 4) redacted
- [ ] Any photo ID / barcode removed or redacted
- [ ] Filename does not include a real name (use `sample-401k.pdf`, not `maya-fidelity-q4.pdf`)
- [ ] Open the redacted PDF in a browser — can you still read the original text if you copy-paste? If yes, redaction failed. Re-export as "flattened PDF" or re-export through Preview's built-in redact tool.

## After you drop them in

- [ ] Visit `http://localhost:3000/samples/sample-401k.pdf` and confirm the PDF loads in the browser.
- [ ] Run Thursday's gold-report generation step (see PROMPTS.md § 7) against each PDF. Save outputs to `samples/gold-report-*.json` — overwriting the synthetic gold reports if the live extraction works well.
- [ ] If the live extraction on either PDF is noticeably worse than the synthetic gold report, that's a signal your PDF is too noisy or unusual — find a cleaner one before Sunday.
