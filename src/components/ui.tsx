import Link from "next/link";
import type { ReactNode } from "react";

/** Page title row with optional description and actions. */
export function PageHeader({ title, description, actions, crumb }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; crumb?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumb && (
          <Link href={crumb.href} className="mb-1 inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink">
            <span aria-hidden="true">&larr;</span> {crumb.label}
          </Link>
        )}
        <h1 className="truncate">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A content card with an optional heading, intro sentence, and right-side slot. */
export function Section({ id, title, intro, aside, children, className = "" }: { id?: string; title?: ReactNode; intro?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`} aria-labelledby={id ? `${id}-h` : undefined}>
      {(title || aside) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 id={id ? `${id}-h` : undefined}>{title}</h2>}
            {intro && <p className="mt-1 text-sm text-ink-2">{intro}</p>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Inline explanation box, used under headings and beside unfamiliar figures. */
export function Explain({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "caution" | "good" }) {
  const cls = tone === "caution" ? "bg-caution-bg text-caution" : tone === "good" ? "bg-good-bg text-good" : "bg-surface-2 text-ink-2";
  return <div className={`rounded-md px-3 py-2 text-sm leading-relaxed ${cls}`}>{children}</div>;
}

export function Metric({ label, children, hint, size = "md", className = "" }: { label: ReactNode; children: ReactNode; hint?: ReactNode; size?: "md" | "lg"; className?: string }) {
  return (
    <div className={`metric ${className}`}>
      <span className="eyebrow">{label}</span>
      <span className={`metric-value num ${size === "lg" ? "metric-hero" : ""}`}>{children}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 p-6">
      <p className="font-medium">{title}</p>
      {children && <p className="text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{children}</kbd>;
}
