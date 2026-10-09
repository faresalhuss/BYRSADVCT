import { roundHalfUp } from "./money";
import type { Cents, Target } from "./types";

export interface TargetInputs {
  targetRatio: number;
  totalSrpCents: Cents | null;
  sellingPriceCents: Cents | null;
  dealerFeesCents: Cents | null;
  dealerAddonsCents: Cents | null;
}

/**
 * Given a target all-in percentage of total SRP, the selling price to ask for
 * (keeping the dealer's fees as quoted) and the gap from the current offer.
 */
export function buildTarget(t: TargetInputs): Target {
  const targetAllIn = t.totalSrpCents === null ? null : roundHalfUp(t.totalSrpCents * t.targetRatio);
  const withAddons =
    targetAllIn === null || t.dealerFeesCents === null || t.dealerAddonsCents === null ? null : targetAllIn - t.dealerFeesCents - t.dealerAddonsCents;
  const noAddons = targetAllIn === null || t.dealerFeesCents === null ? null : targetAllIn - t.dealerFeesCents;
  const gap = withAddons === null || t.sellingPriceCents === null ? null : t.sellingPriceCents - withAddons;
  return {
    targetRatio: t.targetRatio,
    targetAllInCents: targetAllIn,
    targetSellingPriceCents: withAddons,
    targetSellingPriceNoAddonsCents: noAddons,
    gapCents: gap,
  };
}
