import { formatApr, formatCents, formatPercent } from "@/engine/money";

interface MoneyProps {
  cents: number | null | undefined;
  label?: string;
  showCents?: boolean;
  signAlways?: boolean;
  className?: string;
}

/** A money figure with tabular digits and a screen-reader name. */
export function Money({ cents, label, showCents = true, signAlways = false, className = "" }: MoneyProps) {
  const text = cents === null || cents === undefined ? "not yet quoted" : formatCents(cents, { cents: showCents, signAlways });
  return (
    <span className={`num ${className}`} aria-label={label ? `${label}: ${text}` : undefined}>
      {text}
    </span>
  );
}

export function Pct({ value, label, digits = 2, className = "" }: { value: number | null | undefined; label?: string; digits?: number; className?: string }) {
  const text = value === null || value === undefined ? "—" : formatPercent(value, digits);
  return (
    <span className={`num ${className}`} aria-label={label ? `${label}: ${text}` : undefined}>
      {text}
    </span>
  );
}

export function Apr({ value, label, digits = 2, className = "" }: { value: number | null | undefined; label?: string; digits?: number; className?: string }) {
  const text = value === null || value === undefined ? "—" : formatApr(value, digits);
  return (
    <span className={`num ${className}`} aria-label={label ? `${label}: ${text}` : undefined}>
      {text}
    </span>
  );
}
