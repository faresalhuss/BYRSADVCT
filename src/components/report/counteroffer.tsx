"use client";

import { useMemo, useState } from "react";
import { formatCents, formatPercent, roundHalfUp, type VehicleEntered } from "@/engine";

interface Props {
  dealershipName: string;
  salesperson: string | null;
  vehicle: VehicleEntered;
  totalSrpCents: number | null;
  targetRatio: number;
  dealerFeesCents: number | null;
}

export function buildCounteroffer(p: Props): string {
  const who = p.salesperson ? p.salesperson.split(" ")[0] : "there";
  const car = [p.vehicle.year, p.vehicle.make, p.vehicle.model, p.vehicle.trim].filter(Boolean).join(" ") || "the vehicle we discussed";
  const vin = p.vehicle.vin ? `, VIN ${p.vehicle.vin}` : "";
  const stock = p.vehicle.stockNumber ? ` (stock ${p.vehicle.stockNumber})` : "";
  const targetAllIn = p.totalSrpCents === null ? null : roundHalfUp(p.totalSrpCents * p.targetRatio);
  const targetLine =
    targetAllIn === null
      ? "My target is an all-in dealer price (selling price plus every dealer fee and add-on) at or below the number I shared."
      : `My target is an all-in dealer price (selling price plus every dealer fee and add-on, before tax and title) of ${formatCents(targetAllIn, { cents: false })}, which is ${formatPercent(p.targetRatio, 1)} of the ${formatCents(p.totalSrpCents, { cents: false })} total SRP.`;
  return [
    `Hi ${who},`,
    ``,
    `I am interested in the ${car}${vin}${stock}. Please send an itemized out-the-door quote in writing with no trade and no financing assumptions: selling price, each dealer fee and add-on listed separately, tax, title and registration.`,
    ``,
    targetLine,
    ``,
    `If you can meet that in writing, I am ready to move quickly. Trade and financing can be discussed after the price is set.`,
    ``,
    `Thanks,`,
  ].join("\n");
}

export function Counteroffer(p: Props) {
  const initial = useMemo(() => buildCounteroffer(p), [p]);
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Counteroffer message to {p.dealershipName}</h3>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => setText(initial)}>
            Reset
          </button>
          <button type="button" className="btn btn-sm" onClick={copy} aria-live="polite">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <textarea className="field mt-2 min-h-56 py-2 text-sm leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} aria-label="Counteroffer message, editable" />
    </div>
  );
}
