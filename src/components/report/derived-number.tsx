"use client";

import { useId, useState } from "react";
import { formatValue, type Derived } from "@/engine";

const SOURCE_LABEL: Record<string, string> = {
  typed: "typed",
  sticker: "window sticker",
  worksheet: "dealer worksheet",
  assumption: "assumption",
  setting: "setting",
  computed: "computed",
};

/**
 * A number that expands to show how it was derived: formula, inputs and where each came from.
 */
export function DerivedNumber({ d, className = "", emphasis = false, showCents = true }: { d: Derived; className?: string; emphasis?: boolean; showCents?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const text = d.value === null ? "not yet quoted" : d.unit === "cents" && !showCents ? formatValue(Math.round(d.value / 100) * 100, "cents").replace(/\.00$/, "") : formatValue(d.value, d.unit);
  return (
    <span className={`inline ${className}`}>
      <button
        type="button"
        className={`num tap inline-flex items-center rounded-sm px-1 text-left underline decoration-dotted decoration-ink-2/60 underline-offset-4 hover:bg-surface-2 ${emphasis ? "text-accent" : ""} ${d.value === null ? "text-ink-2" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${d.label}: ${text}. Show how this was derived.`}
        onClick={() => setOpen((o) => !o)}
      >
        {text}
      </button>
      <span id={id} className="drawer block" data-open={open}>
        <span className="mt-1 block rounded-md border border-line bg-surface-2/60 p-3 text-left text-xs font-normal normal-case tracking-normal">
          <span className="block font-medium text-ink">{d.label}</span>
          <span className="mt-1 block text-ink-2">= {d.formula}</span>
          {d.inputs.length > 0 && (
            <table className="mt-2 w-full">
              <tbody>
                {d.inputs.map((inp, i) => (
                  <tr key={i} className="border-t border-line/70">
                    <td className="py-1 pr-2 text-ink-2">{inp.label}</td>
                    <td className="num py-1 pr-2 text-right">{inp.value === null ? "not yet quoted" : formatValue(inp.value, inp.unit)}</td>
                    <td className="py-1 text-right text-ink-2">{SOURCE_LABEL[inp.source] ?? inp.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {d.note && <span className="mt-2 block text-ink-2">{d.note}</span>}
        </span>
      </span>
    </span>
  );
}
