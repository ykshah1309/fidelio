import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard shadcn/ui helper — merge Tailwind class strings.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a USD amount as a human string. No cents unless < 100.
 *   42       -> "$42.00"
 *   1234.56  -> "$1,235"
 *   84567    -> "$84,567"
 */
export function formatUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 100) {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Format a percent value.
 *   0.72 -> "0.72%"
 */
export function formatPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

/**
 * Project annual fee drag compounded over N years.
 *
 *   balance:  starting balance, USD
 *   er_pct:   expense ratio as a raw percent (0.72 = 0.72%)
 *   annual_contrib: USD added per year (0 is fine)
 *   nominal_return_pct: 7% is the Fidelio standard assumption
 *   years:    projection horizon
 *
 * Returns the total dollars paid in fees across the horizon, in today's USD.
 *
 * Math sketch:
 *   Each year, balance grows by (return - er). Fees paid that year ≈ balance * er.
 *   Sum over years.
 */
export function projectFeeDrag(opts: {
  balance: number;
  er_pct: number;
  annual_contrib?: number;
  nominal_return_pct?: number;
  years: number;
}): number {
  const {
    balance,
    er_pct,
    annual_contrib = 0,
    nominal_return_pct = 7,
    years,
  } = opts;

  const r_net = (nominal_return_pct - er_pct) / 100;
  const er = er_pct / 100;

  let bal = balance;
  let feesPaid = 0;

  for (let y = 0; y < years; y++) {
    const feesThisYear = bal * er;
    feesPaid += feesThisYear;
    bal = bal * (1 + r_net) + annual_contrib;
  }

  return feesPaid;
}
