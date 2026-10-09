import type { ReactNode } from "react";
import { Money, Pct } from "./money";

interface Props {
  allInRatio: number | null;
  otdCents: number | null;
  openFlags: number;
  /** Right-hand slot: save button, status text. */
  children?: ReactNode;
}

/** The sticky strip with the three numbers that matter. Opaque, no blur. */
export function SummaryBar({ allInRatio, otdCents, openFlags, children }: Props) {
  return (
    <div className="no-print sticky top-12 z-20 -mx-4 border-b border-line bg-surface-2 px-4 py-2 sm:-mx-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <dl className="flex gap-4 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-ink-2">All-in % SRP</dt>
            <dd className="text-lg leading-tight">
              <Pct value={allInRatio} label="All-in as percent of total SRP" />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-ink-2">OTD</dt>
            <dd className="text-lg leading-tight">
              <Money cents={otdCents} label="Out the door" showCents={false} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-ink-2">Flags</dt>
            <dd className={`num text-lg leading-tight ${openFlags > 0 ? "text-flag" : ""}`}>
              <span className="sr-only">Open flags: </span>
              {openFlags}
            </dd>
          </div>
        </dl>
        {children}
      </div>
    </div>
  );
}
