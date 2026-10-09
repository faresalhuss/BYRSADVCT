import { sumKnown } from "./money";
import type { Cents, LineCategory } from "./types";

/** Reconciliation checks used by the import review. Pure, null-aware. */

export interface StickerReconcile {
  sumCents: Cents | null;
  totalCents: Cents | null;
  reconciles: boolean;
}

export function reconcileStickerLines(lines: { cents: Cents | null }[], totalCents: Cents | null): StickerReconcile {
  const s = sumKnown(lines.map((l) => l.cents));
  const sumCents = lines.length === 0 || s.unknown > 0 ? null : s.total;
  return { sumCents, totalCents, reconciles: sumCents !== null && totalCents !== null && sumCents === totalCents };
}

export interface OfferReconcile {
  /** selling price - trade allowance + charges - rebates, or null when any part is unknown. */
  sumCents: Cents | null;
  statedTotalCents: Cents | null;
  hasData: boolean;
  /** True when the sum is known and either matches the stated total or no stated total was printed. */
  reconciles: boolean;
}

export function reconcileOfferLines(offer: {
  sellingPriceCents: Cents | null;
  tradeAllowanceCents: Cents | null;
  statedTotalCents: Cents | null;
  lines: { cents: Cents | null; category: LineCategory }[];
}): OfferReconcile {
  const hasData = offer.sellingPriceCents !== null || offer.lines.length > 0;
  let sum: Cents | null = offer.sellingPriceCents;
  if (sum !== null) {
    sum -= offer.tradeAllowanceCents ?? 0;
    for (const l of offer.lines) {
      if (l.category === "dealer_discount") continue;
      if (l.cents === null) {
        sum = null;
        break;
      }
      sum += l.category === "manufacturer_rebate" || l.category === "conditional_rebate" ? -l.cents : l.cents;
    }
  }
  const reconciles = hasData && sum !== null && (offer.statedTotalCents === null || sum === offer.statedTotalCents);
  return { sumCents: sum, statedTotalCents: offer.statedTotalCents, hasData, reconciles };
}

/** Ratio of price to total SRP for each benchmark that has one, sorted ascending. */
export function benchmarkRatios(benchmarks: { priceCents: Cents; totalSrpCents: Cents | null }[]): number[] {
  return benchmarks
    .map((b) => (b.totalSrpCents ? b.priceCents / b.totalSrpCents : null))
    .filter((r): r is number => r !== null)
    .sort((a, b) => a - b);
}

/** Percent of benchmark ratios that are at or below the given ratio (0 to 100), or null when there are none. */
export function percentileOf(ratio: number, sortedRatios: number[]): number | null {
  if (sortedRatios.length === 0) return null;
  return Math.round((sortedRatios.filter((x) => x <= ratio).length / sortedRatios.length) * 100);
}
