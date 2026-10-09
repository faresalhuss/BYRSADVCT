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
 * The drawer is removed from the accessibility tree while closed.
 */
export function DerivedNumber({ d, className = "", emphasis = false }: { d: Derived; className?: string; emphasis?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const text = formatValue(d.value, d.unit);

  return (
    <div className={`inline-block max-w-full text-right ${className}`}>
      <button
        type="button"
        className={`num tap inline-flex items-center rounded-sm px-1 text-right underline decoration-dotted decoration-ink-2/60 underline-offset-4 hover:bg-surface-2 ${emphasis ? "text-accent" : ""} ${d.value === null ? "text-ink-2" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sr-only">{d.label}: </span>
        {text}
        <span className="sr-only">. Show how this was derived.</span>
      </button>
      {/* inert keeps the closed drawer out of the accessibility tree and tab order while the 140ms transition runs. */}
      <div id={id} className="drawer" data-open={open} inert={!open} aria-hidden={!open}>
        <div>
          <div className="mt-1 rounded-md border border-line bg-surface-2/60 p-3 text-left text-xs font-normal normal-case tracking-normal">
            <p className="font-medium text-ink">{d.label}</p>
            <p className="mt-1 text-ink-2">= {d.formula}</p>
            {d.inputs.length > 0 && (
              <table className="mt-2 w-full">
                <tbody>
                  {d.inputs.map((inp, i) => (
                    <tr key={i} className="border-t border-line/70">
                      <td className="py-1 pr-2 text-ink-2">{inp.label}</td>
                      <td className="num py-1 pr-2 text-right">{formatValue(inp.value, inp.unit)}</td>
                      <td className="py-1 text-right text-ink-2">{SOURCE_LABEL[inp.source] ?? inp.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {d.note && <p className="mt-2 text-ink-2">{d.note}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
