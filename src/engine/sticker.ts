import { derived, input, sumKnown } from "./money";
import type { Derived, Sticker } from "./types";

export interface StickerReport {
  totalSrp: Derived;
  factoryMsrpPlusDph: Derived;
  lineSum: Derived;
  reconciles: boolean | null;
  discrepancy: Derived;
}

export function analyzeSticker(sticker: Sticker): StickerReport {
  const lines = sticker.lines;
  const known = sumKnown(lines.map((l) => l.cents));
  const lineInputs = lines.map((l) => input(l.label, l.cents, "cents", l.source));

  const lineSum = derived(
    "sticker.lineSum",
    "Sum of sticker line items",
    known.unknown > 0 ? null : known.total,
    "cents",
    "base MSRP + factory options + distributor options + DPH",
    lineInputs,
    known.unknown > 0 ? `${known.unknown} line(s) have no amount yet` : undefined,
  );

  const totalSrp = derived(
    "sticker.totalSrp",
    "Total SRP",
    sticker.totalSrpCents,
    "cents",
    "bottom line of the window sticker",
    [input("Total SRP (printed)", sticker.totalSrpCents, "cents", "sticker")],
  );

  const factoryLines = lines.filter((l) => l.group === "base" || l.group === "factory_option" || l.group === "dph");
  const factory = sumKnown(factoryLines.map((l) => l.cents));
  const factoryMsrpPlusDph = derived(
    "sticker.factoryMsrpPlusDph",
    "Factory MSRP + DPH",
    factory.unknown > 0 ? null : factory.total,
    "cents",
    "base MSRP + factory options + DPH (excludes distributor and dealer additions)",
    factoryLines.map((l) => input(l.label, l.cents, "cents", l.source)),
  );

  const reconciles =
    lineSum.value === null || totalSrp.value === null ? null : lineSum.value === totalSrp.value;
  const discrepancy = derived(
    "sticker.discrepancy",
    "Sticker discrepancy",
    lineSum.value === null || totalSrp.value === null ? null : totalSrp.value - lineSum.value,
    "cents",
    "Total SRP - sum of line items",
    [
      input("Total SRP", totalSrp.value, "cents", "sticker"),
      input("Sum of line items", lineSum.value, "cents", "computed"),
    ],
  );

  return { totalSrp, factoryMsrpPlusDph, lineSum, reconciles, discrepancy };
}
