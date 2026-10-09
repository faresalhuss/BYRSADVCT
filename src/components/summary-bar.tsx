import type { ReactNode } from "react";
import { formatCents, formatPercent } from "@/engine/money";
import { Term } from "./term";

interface Props {
  allInRatio: number | null;
  otdCents: number | null;
  openFlags: number;
  /** Right-hand slot: save button, status text. */
  children?: ReactNode;
}

/**
 * The sticky strip with the three numbers that matter. Each value remounts (keyed by its text)
 * when it changes, which replays the `.tick` highlight: a visible confirmation that a keystroke
 * changed the deal.
 */
export function SummaryBar({ allInRatio, otdCents, openFlags, children }: Props) {
  const ratioText = formatPercent(allInRatio);
  const otdText = formatCents(otdCents, { cents: false });
  return (
    <div className="no-print sticky top-12 z-20 -mx-4 border-b border-line bg-surface-2 px-4 py-2.5 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <dl className="flex gap-5 sm:gap-8">
          <div className="metric">
            <dt className="eyebrow">
              <Term k="all_in">All-in, % of SRP</Term>
            </dt>
            <dd key={ratioText} className="metric-value num tick text-xl sm:text-2xl">
              <span className="sr-only">All-in as percent of total SRP: </span>
              {ratioText}
            </dd>
          </div>
          <div className="metric">
            <dt className="eyebrow">
              <Term k="otd">Out the door</Term>
            </dt>
            <dd key={otdText} className="metric-value num tick text-xl sm:text-2xl">
              <span className="sr-only">Out the door: </span>
              {otdText}
            </dd>
          </div>
          <div className="metric">
            <dt className="eyebrow">Flags</dt>
            <dd key={openFlags} className={`metric-value num tick text-xl sm:text-2xl ${openFlags > 0 ? "text-flag" : "text-good"}`}>
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
