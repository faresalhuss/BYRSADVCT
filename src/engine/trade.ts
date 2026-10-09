import { derived, divByOnePlusRate, formatApr, input, mulRate } from "./money";
import { daysBetween, tradeCreditApplies } from "./tax";
import type { Cents, DealReport, Offer, OutsideOffer, TaxRule, TradeProfile } from "./types";

export function bestUnexpiredOffer(trade: TradeProfile, today: string): OutsideOffer | null {
  let best: OutsideOffer | null = null;
  for (const o of trade.outsideOffers) {
    if (o.expiresOn !== null && daysBetween(today, o.expiresOn) < 0) continue;
    if (best === null || o.cents > best.cents) best = o;
  }
  return best;
}

export interface TradeInputs {
  offer: Offer;
  trade: TradeProfile;
  rule: TaxRule;
  today: string;
  /** All-in dealer price + non-tax government fees (everything except tax). */
  preTaxCostCents: Cents | null;
  /** Tax with the trade credit applied (the correct computed tax). */
  taxWithTradeCents: Cents | null;
  /** Tax with no trade credit. */
  taxNoTradeCents: Cents | null;
}

export function analyzeTrade(t: TradeInputs): DealReport["trade"] {
  const { offer, trade, rule, today } = t;
  const applies = tradeCreditApplies(rule, trade);
  const allowanceCents = offer.tradeAllowanceCents;
  const rateInput = input(`${rule.name} rate`, rule.rate, "rate", "setting");

  const allowance = derived("trade.allowance", "Trade allowance", allowanceCents, "cents", "dealer's number for the trade", [
    input("Trade allowance", allowanceCents, "cents", "worksheet"),
  ]);
  const payoff = derived("trade.payoff", "Trade payoff", trade.payoffCents, "cents", "lender's payoff amount", [
    input("Payoff", trade.payoffCents, "cents", "typed"),
    input("Good through", trade.payoffGoodThrough, "date", "typed"),
  ]);
  const equity = derived(
    "trade.equity",
    "Trade equity",
    allowanceCents === null || trade.payoffCents === null ? null : allowanceCents - trade.payoffCents,
    "cents",
    "allowance - payoff",
    [input("Trade allowance", allowanceCents, "cents", "worksheet"), input("Payoff", trade.payoffCents, "cents", "typed")],
    "Negative equity means you owe more than the dealer allows.",
  );

  const rateText = formatApr(rule.rate, 2);
  // The credit cannot exceed the tax that would be due without it (the base is floored at zero).
  const capCents = t.taxNoTradeCents;
  const rawTaxValue = allowanceCents === null ? null : applies ? mulRate(allowanceCents, rule.rate, rule.ratePrecision) : 0;
  const taxValueCents = rawTaxValue === null ? null : capCents !== null && rawTaxValue > capCents ? capCents : rawTaxValue;
  const taxValue = derived(
    "trade.taxValue",
    "Tax value of the trade credit",
    taxValueCents,
    "cents",
    applies ? `allowance x ${rateText}, capped at the tax due without the credit` : "credit does not apply",
    [input("Trade allowance", allowanceCents, "cents", "worksheet"), rateInput, input("Tax without trade credit", capCents, "cents", "computed")],
    applies ? undefined : "The trade credit only applies when the trade's VIN and owner are recorded on a dealer sale.",
  );
  const effectiveCents = allowanceCents === null || taxValueCents === null ? null : allowanceCents + taxValueCents;
  const effectiveValue = derived("trade.effective", "Effective dealer trade value", effectiveCents, "cents", "allowance + tax value", [
    input("Trade allowance", allowanceCents, "cents", "worksheet"),
    input("Tax value", taxValueCents, "cents", "computed"),
  ]);

  const best = bestUnexpiredOffer(trade, today);
  const breakEvenCents = best === null ? null : applies ? divByOnePlusRate(best.cents, rule.rate, rule.ratePrecision) : best.cents;
  const breakEvenAllowance = derived(
    "trade.breakEven",
    "Break-even dealer allowance",
    breakEvenCents,
    "cents",
    applies ? `outside offer / (1 + ${rateText})` : "outside offer (no tax credit applies)",
    [input(best ? `Outside offer (${best.source})` : "Best outside offer", best?.cents ?? null, "cents", "typed"), rateInput],
    "A dealer allowance at or above this nets you at least as much as selling outside.",
  );

  const routeA = derived("trade.routeA", "Route A: trade to this dealer", effectiveCents, "cents", "allowance + tax value", [
    input("Effective dealer trade value", effectiveCents, "cents", "computed"),
  ]);
  const routeB = derived("trade.routeB", "Route B: sell to best outside offer", best?.cents ?? null, "cents", "outside offer, no tax credit", [
    input(best ? `Outside offer (${best.source})` : "Best outside offer", best?.cents ?? null, "cents", "typed"),
  ]);
  let winner: DealReport["trade"]["winner"] = null;
  let marginCents: Cents | null = null;
  if (effectiveCents !== null && best !== null) {
    marginCents = effectiveCents - best.cents;
    winner = marginCents > 0 ? "trade" : marginCents < 0 ? "outside" : "tie";
  }
  const margin = derived(
    "trade.margin",
    "Trade route margin",
    marginCents,
    "cents",
    "route A - route B",
    [input("Route A", effectiveCents, "cents", "computed"), input("Route B", best?.cents ?? null, "cents", "computed")],
    "Positive means trading to the dealer nets more; negative means the outside offer wins.",
  );

  const rawMatch = best === null ? null : applies ? mulRate(best.cents, rule.rate, rule.ratePrecision) : 0;
  const matchCents = rawMatch === null ? null : capCents !== null && rawMatch > capCents ? capCents : rawMatch;
  const ifDealerMatches = derived(
    "trade.ifMatches",
    "Margin if the dealer matches the outside offer",
    matchCents,
    "cents",
    applies ? `outside offer x ${rateText}, capped at the tax due without the credit` : "0 (no tax credit applies)",
    [input("Best outside offer", best?.cents ?? null, "cents", "typed"), rateInput],
  );

  // With vs without trade: net cost of the purchase after the trade proceeds.
  const netWith = t.preTaxCostCents === null || t.taxWithTradeCents === null || allowanceCents === null ? null : t.preTaxCostCents + t.taxWithTradeCents - allowanceCents;
  const netCostWithTrade = derived(
    "trade.netWith",
    "Net cost, trading to this dealer",
    netWith,
    "cents",
    "all-in + government fees + tax (with trade credit) - trade allowance",
    [
      input("All-in + non-tax government fees", t.preTaxCostCents, "cents", "computed"),
      input("Tax with trade credit", t.taxWithTradeCents, "cents", "computed"),
      input("Trade allowance", allowanceCents, "cents", "worksheet"),
    ],
    "Payoff is the same on either route and is left out.",
  );
  const netOutside = t.preTaxCostCents === null || t.taxNoTradeCents === null || best === null ? null : t.preTaxCostCents + t.taxNoTradeCents - best.cents;
  const netCostOutside = derived(
    "trade.netOutside",
    "Net cost, selling outside",
    netOutside,
    "cents",
    "all-in + government fees + tax (no trade credit) - outside offer",
    [
      input("All-in + non-tax government fees", t.preTaxCostCents, "cents", "computed"),
      input("Tax without trade credit", t.taxNoTradeCents, "cents", "computed"),
      input(best ? `Outside offer (${best.source})` : "Best outside offer", best?.cents ?? null, "cents", "typed"),
    ],
  );

  return {
    allowance,
    payoff,
    equity,
    taxValue,
    effectiveValue,
    bestOutsideOffer: best,
    breakEvenAllowance,
    routeA,
    routeB,
    winner,
    margin,
    ifDealerMatches,
    netCostWithTrade,
    netCostOutside,
  };
}
