import type { Cents, Derived, DerivationInput, Source, Unit } from "./types";

/** Round half up (toward positive infinity at exactly .5). */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/**
 * Multiply integer cents by a decimal rate using integer arithmetic so that
 * 0.07 * 38,113.00 never lands on 2,667.909999. `precision` is the number of
 * decimal places the rate is trusted to.
 */
export function mulRate(cents: Cents, rate: number, precision = 6): Cents {
  const scale = 10 ** precision;
  const scaledRate = Math.round(rate * scale);
  const product = cents * scaledRate;
  return Math.floor((product + scale / 2) / scale);
}

/** Divide cents by (1 + rate), rounded half up. Used for break-even. */
export function divByOnePlusRate(cents: Cents, rate: number, precision = 6): Cents {
  const scale = 10 ** precision;
  const denom = scale + Math.round(rate * scale);
  return Math.floor((cents * scale + denom / 2) / denom);
}

/** Ratio a/b as a decimal, or null if either side is unknown or b is zero. */
export function ratio(a: Cents | null, b: Cents | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

/**
 * Parse pasted money text. Accepts "$58,714.00", "58714", "58.7k", "(1,505)",
 * "-1,505.00", "1 505". Returns integer cents or null when unparseable.
 */
export function parseMoney(raw: string | number | null | undefined): Cents | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return roundHalfUp(raw * 100);
  }
  let s = raw.trim().toLowerCase();
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "").replace(/usd$/i, "");
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  let multiplier = 1;
  if (s.endsWith("k")) {
    multiplier = 1000;
    s = s.slice(0, -1);
  } else if (s.endsWith("m")) {
    multiplier = 1_000_000;
    s = s.slice(0, -1);
  }
  if (!/^\d*(\.\d*)?$/.test(s) || s === "" || s === ".") return null;
  const [whole = "0", frac = ""] = s.split(".");
  // Work in integers: whole*100 + frac (padded/truncated to cents) then apply the multiplier.
  if (multiplier === 1) {
    const fracCents = (frac + "00").slice(0, 2);
    const extra = frac.slice(2);
    let cents = Number(whole) * 100 + Number(fracCents);
    if (extra !== "" && Number("0." + extra) >= 0.5) cents += 1;
    return negative ? -cents : cents;
  }
  const value = Number(whole + "." + frac) * multiplier;
  const cents = roundHalfUp(value * 100);
  return negative ? -cents : cents;
}

export interface FormatOptions {
  /** Show cents (default true). */
  cents?: boolean;
  /** Prefix with $ (default true). */
  symbol?: boolean;
  /** Show an explicit + for positive values. */
  signAlways?: boolean;
}

const dollars = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeDollars = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Format cents as "-$1,505.00". Negative values always carry a leading minus, never parentheses. */
export function formatCents(cents: Cents | null, opts: FormatOptions = {}): string {
  if (cents === null || !Number.isFinite(cents)) return "—";
  const showCents = opts.cents ?? true;
  const symbol = opts.symbol ?? true;
  const abs = Math.abs(cents);
  const body = showCents ? dollars.format(abs / 100) : wholeDollars.format(Math.round(abs / 100));
  const sign = cents < 0 ? "-" : opts.signAlways && cents > 0 ? "+" : "";
  return `${sign}${symbol ? "$" : ""}${body}`;
}

export function formatPercent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatApr(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatValue(value: number | string | null, unit: Unit): string {
  if (value === null) return "not yet quoted";
  switch (unit) {
    case "cents":
      return formatCents(value as number);
    case "rate":
      return formatApr(value as number, 3);
    case "ratio":
      return formatPercent(value as number);
    case "months":
      return `${value} mo`;
    case "count":
      return String(value);
    case "date":
    case "text":
      return String(value);
  }
}

/* ---------- Derivation helpers ---------- */

export function input(label: string, value: number | string | null, unit: Unit, source: Source): DerivationInput {
  return { label, value, unit, source };
}

export function derived(
  id: string,
  label: string,
  value: number | null,
  unit: Unit,
  formula: string,
  inputs: DerivationInput[],
  note?: string,
): Derived {
  const d: Derived = { id, label, value: value === null || Number.isNaN(value) ? null : value, unit, formula, inputs };
  if (note) d.note = note;
  return d;
}

/** Sum of possibly-unknown cents. Null if any term is unknown. */
export function sumCents(values: (Cents | null)[]): Cents | null {
  let total = 0;
  for (const v of values) {
    if (v === null) return null;
    total += v;
  }
  return total;
}

/** Sum that skips unknowns but reports whether any were skipped. */
export function sumKnown(values: (Cents | null)[]): { total: Cents; unknown: number } {
  let total = 0;
  let unknown = 0;
  for (const v of values) {
    if (v === null) unknown += 1;
    else total += v;
  }
  return { total, unknown };
}

export function sub(a: Cents | null, b: Cents | null): Cents | null {
  if (a === null || b === null) return null;
  return a - b;
}

export function add(a: Cents | null, b: Cents | null): Cents | null {
  if (a === null || b === null) return null;
  return a + b;
}
