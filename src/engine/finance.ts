import { roundHalfUp } from "./money";
import type { Cents } from "./types";

/** Monthly payment for a fully amortizing loan, rounded half up to the cent. */
export function amortizedPayment(principalCents: Cents, apr: number, termMonths: number): Cents {
  if (termMonths <= 0) throw new RangeError("termMonths must be positive");
  if (apr < 0) throw new RangeError("apr must not be negative");
  if (apr === 0) return roundHalfUp(principalCents / termMonths);
  const i = apr / 12;
  const factor = i / (1 - Math.pow(1 + i, -termMonths));
  return roundHalfUp(principalCents * factor);
}

/** Exact (unrounded) payment, used for solving. */
function exactPayment(principal: number, apr: number, n: number): number {
  if (apr === 0) return principal / n;
  const i = apr / 12;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

/** Present value of a level payment stream at a given APR. */
export function presentValue(paymentCents: Cents, apr: number, termMonths: number): Cents {
  if (apr === 0) return roundHalfUp(paymentCents * termMonths);
  const i = apr / 12;
  return roundHalfUp((paymentCents * (1 - Math.pow(1 + i, -termMonths))) / i);
}

/**
 * Solve the APR that produces `paymentCents` on `principalCents` over `termMonths`.
 * Bisection to 0.00001 (0.001 percentage points) or better. Returns null when the
 * payment cannot be produced by any non-negative rate (payment too small) or inputs are missing.
 */
export function impliedApr(principalCents: Cents, paymentCents: Cents, termMonths: number): number | null {
  if (principalCents <= 0 || paymentCents <= 0 || termMonths <= 0) return null;
  const zeroRate = principalCents / termMonths;
  // Allow half a cent of rounding slack at a zero rate.
  if (paymentCents < zeroRate - 0.5) return null;
  if (Math.abs(paymentCents - zeroRate) <= 0.5) return 0;
  let lo = 0;
  let hi = 2; // 200% APR ceiling
  if (exactPayment(principalCents, hi, termMonths) < paymentCents) return null;
  for (let k = 0; k < 200; k += 1) {
    const mid = (lo + hi) / 2;
    if (exactPayment(principalCents, mid, termMonths) > paymentCents) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-9) break;
  }
  const apr = (lo + hi) / 2;
  return Math.round(apr * 1e7) / 1e7;
}

export function totalInterest(principalCents: Cents, paymentCents: Cents, termMonths: number): Cents {
  return paymentCents * termMonths - principalCents;
}

/**
 * Payment gap: how much a quoted payment exceeds the computed payment at the stated APR,
 * and the hidden principal that gap implies (the extra amount that would have to be
 * financed for the quoted payment to be correct at that APR).
 */
export function paymentGap(
  principalCents: Cents,
  apr: number,
  termMonths: number,
  quotedPaymentCents: Cents,
): { computedPaymentCents: Cents; gapCents: Cents; hiddenPrincipalCents: Cents } {
  const computedPaymentCents = amortizedPayment(principalCents, apr, termMonths);
  const gapCents = quotedPaymentCents - computedPaymentCents;
  const hiddenPrincipalCents = presentValue(quotedPaymentCents, apr, termMonths) - principalCents;
  return { computedPaymentCents, gapCents, hiddenPrincipalCents };
}
