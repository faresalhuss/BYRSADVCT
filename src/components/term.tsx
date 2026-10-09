"use client";

import Link from "next/link";
import { useId } from "react";
import { GLOSSARY_BY_KEY } from "@/content/glossary";

/**
 * A term with a dotted underline that opens a plain-language explanation.
 * Uses the native popover API (top layer, Escape to close, light dismiss), so no
 * positioning library and nothing to trap focus by hand.
 */
export function Term({ k, children }: { k: string; children?: React.ReactNode }) {
  const id = useId();
  const entry = GLOSSARY_BY_KEY[k];
  if (!entry) return <>{children ?? k}</>;
  const popId = `term-${id.replace(/:/g, "")}`;
  return (
    <>
      <button type="button" className="term" popoverTarget={popId} aria-describedby={popId}>
        {children ?? entry.term}
      </button>
      <div id={popId} popover="auto" className="panel m-auto w-[min(92vw,26rem)] p-4 text-sm shadow-[var(--shadow)] backdrop:bg-black/40">
        <p className="eyebrow">Term</p>
        <p className="mt-1 text-base font-semibold">{entry.term}</p>
        <p className="mt-1 text-ink-2">{entry.short}</p>
        <dl className="mt-3 flex flex-col gap-2">
          <div>
            <dt className="eyebrow">What it is</dt>
            <dd className="mt-0.5 text-ink">{entry.what}</dd>
          </div>
          <div>
            <dt className="eyebrow">How dealers use it</dt>
            <dd className="mt-0.5 text-ink">{entry.dealer}</dd>
          </div>
          <div>
            <dt className="eyebrow">What to ask</dt>
            <dd className="mt-0.5 text-ink">{entry.ask}</dd>
          </div>
        </dl>
        <div className="mt-3 flex items-center justify-between">
          <Link href={`/glossary#${entry.key}`} className="text-xs text-accent underline">
            Full glossary
          </Link>
          <button type="button" className="btn btn-sm" popoverTarget={popId} popoverTargetAction="hide">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
