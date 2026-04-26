/**
 * Plain-English definitions for financial terms used throughout Fidelio.
 * Applied via the FinanceTerm tooltip component.
 * Keyed by lowercase term exactly as it appears in copy.
 */

export const FINANCE_GLOSSARY: Record<string, string> = {
  "expense ratio":
    "The annual fee a fund charges, as a % of your balance. At 0.72%, you pay $7.20 per year for every $1,000 invested — silently deducted, never billed.",
  "expense ratios":
    "Annual fees funds charge as a % of your balance. They compound against you the same way returns compound for you.",
  "employer match":
    "Free money your employer adds to your 401(k) when you contribute. A 50% match up to 6% means contributing 6% earns you an extra 3% on top.",
  "target date fund":
    "A fund that auto-adjusts its stock/bond mix as you approach retirement. The year in the name (e.g., 2060) is your expected retirement year.",
  "index fund":
    "A fund that tracks a market index like the S&P 500. No human picks stocks, so fees are very low — usually under 0.10%.",
  "vesting":
    "How employer contributions become truly yours over time. If you're 50% vested, only half of your employer's contributions belong to you if you leave today.",
  "allocation":
    "How your money is divided across different investments, expressed as a percentage of your total balance.",
  "rebalancing":
    "Adjusting your portfolio back to your target mix by buying and selling funds — e.g., if stocks grew to 80% but your target is 70%.",
  "ytd":
    "Year-to-date: the total amount contributed or earned since January 1 of the current calendar year.",
  "gross pay":
    "Your total earnings before any deductions — taxes, health insurance, retirement contributions, etc.",
  "net pay":
    "What actually hits your bank account after all deductions. Sometimes called 'take-home pay.'",
  "fica":
    "Federal Insurance Contributions Act — the Social Security + Medicare taxes taken from every paycheck. 6.2% for Social Security, 1.45% for Medicare.",
  "hsa":
    "Health Savings Account: a triple-tax-advantaged account for medical expenses. Contributions are pre-tax, growth is tax-free, and withdrawals for medical costs are tax-free.",
  "fsa":
    "Flexible Spending Account: like an HSA, but usually 'use it or lose it' — unspent funds don't roll over to next year.",
  "withholding":
    "The portion of your paycheck your employer sends directly to the IRS as an estimate of what you'll owe in income taxes. If too much is withheld, you get a refund. Too little, you owe at tax time.",
  "403(b)":
    "The 401(k) equivalent for non-profit and government employees. Same tax advantages, same basic mechanics.",
  "ira":
    "Individual Retirement Account: a personal retirement account you open yourself (not through an employer). Comes in Traditional (pre-tax) and Roth (after-tax) flavors.",
};
