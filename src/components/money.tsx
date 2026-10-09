import { formatApr, formatCents, formatPercent } from "@/engine/money";

interface MoneyProps {
  cents: number | null | undefined;
  label?: string;
  showCents?: boolean;
  signAlways?: boolean;
  className?: string;
}

/** A money figure with tabular digits and a screen-reader name (visually hidden prefix, not aria-label on a span). */
export function Money({ cents, label, showCents = true, signAlways = false, className = "" }: MoneyProps) {
  const text = formatCents(cents ?? null, { cents: showCents, signAlways });
  return (
    <span className={`num ${className}`}>
      {label && <span className="sr-only">{label}: </span>}
      {text}
    </span>
  );
}

export function Pct({ value, label, digits = 2, className = "" }: { value: number | null | undefined; label?: string; digits?: number; className?: string }) {
  const text = formatPercent(value ?? null, digits);
  return (
    <span className={`num ${className}`}>
      {label && <span className="sr-only">{label}: </span>}
      {text}
    </span>
  );
}

export function Apr({ value, label, digits = 2, className = "" }: { value: number | null | undefined; label?: string; digits?: number; className?: string }) {
  const text = formatApr(value ?? null, digits);
  return (
    <span className={`num ${className}`}>
      {label && <span className="sr-only">{label}: </span>}
      {text}
    </span>
  );
}
