"use client";

import Link from "next/link";
import { useId } from "react";
import { GLOSSARY_BY_KEY } from "@/content/glossary";

/**
 * A term with a dotted underline that opens a plain-language explanation.
 * Uses the native popover API (top layer, Escape to close, light dismiss). Everything is
 * rendered with inline elements so a Term can sit inside a paragraph, a table cell or a label
 * without producing invalid HTML nesting.
 */
export function Term({ k, children }: { k: string; children?: React.ReactNode }) {
  const id = useId();
  const entry = GLOSSARY_BY_KEY[k];
  if (!entry) return <>{children ?? k}</>;
  const popId = `term-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <>
      <button type="button" className="term" popoverTarget={popId} aria-haspopup="dialog">
        {children ?? entry.term}
      </button>
      <span id={popId} popover="auto" role="dialog" aria-label={`${entry.term}, explained`} className="panel m-auto w-[min(92vw,26rem)] p-4 text-left text-sm font-normal normal-case tracking-normal text-ink shadow-[var(--shadow)] backdrop:bg-black/50">
        <span className="eyebrow block">Term</span>
        <span className="mt-1 block text-base font-semibold">{entry.term}</span>
        <span className="mt-1 block text-ink-2">{entry.short}</span>
        <span className="mt-3 block">
          <span className="eyebrow block">What it is</span>
          <span className="mt-0.5 block">{entry.what}</span>
        </span>
        <span className="mt-2 block">
          <span className="eyebrow block">How dealers use it</span>
          <span className="mt-0.5 block">{entry.dealer}</span>
        </span>
        <span className="mt-2 block">
          <span className="eyebrow block">What to ask</span>
          <span className="mt-0.5 block">{entry.ask}</span>
        </span>
        <span className="mt-3 flex items-center justify-between">
          <Link href={`/glossary#${entry.key}`} className="text-xs text-accent underline">
            Full glossary
          </Link>
          <button type="button" className="btn btn-sm" popoverTarget={popId} popoverTargetAction="hide">
            Close
          </button>
        </span>
      </span>
    </>
  );
}
