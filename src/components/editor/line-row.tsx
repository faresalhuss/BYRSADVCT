"use client";

import type { ReactNode } from "react";

/**
 * One line item in the editor. Stacks on phones (label, then classification, then amount)
 * and lays out in a row from 640px up. The remove control is always a labeled button.
 */
export function LineRow({ children, onRemove, removeLabel, note }: { children: ReactNode; onRemove: () => void; removeLabel: string; note?: ReactNode }) {
  return (
    <li className="border-t border-line/70 py-2 first:border-t-0">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_9rem_minmax(0,1.2fr)_auto] sm:items-start">
        {children}
        <button type="button" className="btn btn-quiet btn-sm justify-self-end text-ink-2" aria-label={removeLabel} onClick={onRemove}>
          Remove
        </button>
      </div>
      {note && <div className="mt-2 grid gap-2 sm:grid-cols-2">{note}</div>}
    </li>
  );
}

export function LineList({ children, empty }: { children: ReactNode; empty: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  if (!hasChildren) return <p className="text-sm text-ink-2">{empty}</p>;
  return <ul className="flex flex-col">{children}</ul>;
}
