"use client";

import { useId, useState } from "react";
import { buildTarget, formatCents, formatPercent } from "@/engine";

interface Props {
  totalSrpCents: number | null;
  sellingPriceCents: number | null;
  dealerFeesCents: number | null;
  dealerAddonsCents: number | null;
  defaultRatio: number;
  beatsBestRatio: number;
}

export function TargetBuilder(p: Props) {
  const [ratioText, setRatioText] = useState((p.defaultRatio * 100).toFixed(1));
  const id = useId();
  const ratio = Number(ratioText) / 100;
  const valid = Number.isFinite(ratio) && ratio > 0.5 && ratio < 1.5;
  const t = buildTarget({ targetRatio: valid ? ratio : p.defaultRatio, totalSrpCents: p.totalSrpCents, sellingPriceCents: p.sellingPriceCents, dealerFeesCents: p.dealerFeesCents, dealerAddonsCents: p.dealerAddonsCents });
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-sm font-medium">
            Target all-in, % of total SRP
          </label>
          <div className="relative w-36">
            <input id={id} type="text" inputMode="decimal" className="field num pr-8 text-right" value={ratioText} onChange={(e) => setRatioText(e.target.value)} aria-invalid={valid ? undefined : "true"} />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-2">
              %
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm" onClick={() => setRatioText((p.defaultRatio * 100).toFixed(1))}>
            Strong {formatPercent(p.defaultRatio, 1)}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setRatioText((p.beatsBestRatio * 100).toFixed(1))}>
            Beats best {formatPercent(p.beatsBestRatio, 1)}
          </button>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-md border border-line p-3">
          <dt className="text-xs uppercase tracking-wide text-ink-2">Target all-in</dt>
          <dd className="num text-lg">{formatCents(t.targetAllInCents)}</dd>
        </div>
        <div className="rounded-md border border-line p-3">
          <dt className="text-xs uppercase tracking-wide text-ink-2">Selling price to ask for</dt>
          <dd className="num text-lg">{formatCents(t.targetSellingPriceCents)}</dd>
          <dd className="num text-xs text-ink-2">{formatCents(t.targetSellingPriceNoAddonsCents)} if add-ons are removed</dd>
        </div>
        <div className="rounded-md border border-line p-3">
          <dt className="text-xs uppercase tracking-wide text-ink-2">Gap from current offer</dt>
          <dd className={`num text-lg ${t.gapCents !== null && t.gapCents > 0 ? "text-flag" : "text-good"}`}>{formatCents(t.gapCents)}</dd>
          <dd className="text-xs text-ink-2">{t.gapCents === null ? "Needs selling price, fees and total SRP" : t.gapCents > 0 ? "Dealer must come down by this much" : "Already at or below target"}</dd>
        </div>
      </dl>
    </div>
  );
}
