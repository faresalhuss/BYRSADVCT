import type { CompareMode, CompareResult, CompareRow, DealReport, OutsideOffer, TaxRule, TradeProfile, Unit } from "./types";
import { daysBetween, tradeCreditApplies } from "./tax";
import { mulRate } from "./money";

function row(key: string, label: string, unit: Unit, values: (number | null)[], lowerIsBetter: boolean): CompareRow {
  let bestIndex: number | null = null;
  values.forEach((v, i) => {
    if (v === null) return;
    if (bestIndex === null) {
      bestIndex = i;
      return;
    }
    const best = values[bestIndex]!;
    if (lowerIsBetter ? v < best : v > best) bestIndex = i;
  });
  // No "best" when every known value is equal.
  const known = values.filter((v): v is number => v !== null);
  if (known.length > 1 && known.every((v) => v === known[0])) bestIndex = null;
  return { key, label, unit, values, bestIndex, lowerIsBetter };
}

export function compareDeals(reports: DealReport[], mode: CompareMode): CompareResult {
  if (reports.length < 2 || reports.length > 6) {
    throw new RangeError("compare 2 to 6 deals");
  }
  const rows: CompareRow[] = [
    row("totalSrp", "Total SRP", "cents", reports.map((r) => r.sticker.totalSrp.value), true),
    row("selling", "Selling price", "cents", reports.map((r) => r.price.sellingPrice.value), true),
    row("discountPct", "Discount off SRP", "ratio", reports.map((r) => r.price.discountPct.value), false),
    row("dealerFees", "Dealer fees", "cents", reports.map((r) => r.price.dealerFees.value), true),
    row("dealerAddons", "Dealer add-ons", "cents", reports.map((r) => r.price.dealerAddons.value), true),
    row("allIn", "All-in dealer price", "cents", reports.map((r) => r.price.allIn.value), true),
    row("allInRatio", "All-in % of SRP", "ratio", reports.map((r) => r.price.allInRatio.value), true),
    row("tax", "Tax (computed)", "cents", reports.map((r) => r.tax.computedTax.value), true),
    row("govFees", "Government fees", "cents", reports.map((r) => r.price.govFees.value), true),
    row("otd", "Out the door", "cents", reports.map((r) => r.price.otd.value), true),
    row("flags", "Open flags", "count", reports.map((r) => r.flags.filter((f) => f.severity === "flag").length), true),
  ];
  if (mode === "with_trade") {
    rows.push(
      row("allowance", "Trade allowance", "cents", reports.map((r) => r.trade.allowance.value), false),
      row("equity", "Trade equity", "cents", reports.map((r) => r.trade.equity.value), false),
      row("taxValue", "Tax value of trade", "cents", reports.map((r) => r.trade.taxValue.value), false),
      row("effective", "Effective trade value", "cents", reports.map((r) => r.trade.effectiveValue.value), false),
      row("netWith", "Net cost, trade to dealer", "cents", reports.map((r) => r.trade.netCostWithTrade.value), true),
      row("netOutside", "Net cost, sell outside", "cents", reports.map((r) => r.trade.netCostOutside.value), true),
    );
  }

  const metric = (r: DealReport) => (mode === "price_only" ? r.price.allIn.value : r.trade.netCostWithTrade.value);
  const entries = reports.map((r) => ({ dealId: r.id, metricCents: metric(r), complete: r.complete && metric(r) !== null }));
  const sorted = entries.filter((e) => e.complete).sort((a, b) => a.metricCents! - b.metricCents!);
  const ranking = entries.map((e) => ({
    dealId: e.dealId,
    complete: e.complete,
    metricCents: e.metricCents,
    rank: e.complete ? sorted.findIndex((s) => s.dealId === e.dealId) + 1 : null,
  }));
  const best = sorted[0] ?? null;
  const push = best
    ? sorted.slice(1).map((e) => ({ dealId: e.dealId, targetCents: best.metricCents!, gapCents: e.metricCents! - best.metricCents! }))
    : [];

  return { mode, dealIds: reports.map((r) => r.id), names: reports.map((r) => r.name), rows, ranking, push };
}


/* ---------- The trade vehicle: every way to dispose of it, ranked ---------- */

export interface TradeRoute {
  key: string;
  kind: "dealer" | "outside";
  label: string;
  /** Allowance or cash offer. */
  grossCents: number | null;
  /** Tax credit worth (dealer routes only). */
  taxValueCents: number | null;
  /** What the route nets you: allowance + tax credit, or the outside cash. */
  netCents: number | null;
  /** Net minus the loan payoff: the cash (or shortfall, negative) left once the lender is paid. Null when no payoff is entered. */
  afterPayoffCents: number | null;
  expiresOn: string | null;
  expired: boolean;
  contingent: boolean;
  dealId: string | null;
  rank: number | null;
}

function afterPayoff(netCents: number | null, payoffCents: number | null): number | null {
  if (netCents === null || payoffCents === null) return null;
  return netCents - payoffCents;
}

export function compareTradeRoutes(reports: DealReport[], trade: TradeProfile, rule: TaxRule, today: string): TradeRoute[] {
  const applies = tradeCreditApplies(rule, trade);
  const routes: TradeRoute[] = [];
  for (const r of reports) {
    const a = r.trade.allowance.value;
    if (a === null) continue;
    const tv = r.trade.taxValue.value ?? (applies ? mulRate(a, rule.rate, rule.ratePrecision) : 0);
    routes.push({ key: `deal:${r.id}`, kind: "dealer", label: `Trade to ${r.name}`, grossCents: a, taxValueCents: tv, netCents: a + tv, afterPayoffCents: afterPayoff(a + tv, trade.payoffCents), expiresOn: null, expired: false, contingent: false, dealId: r.id, rank: null });
  }
  for (const o of trade.outsideOffers as OutsideOffer[]) {
    const expired = o.expiresOn !== null && daysBetween(today, o.expiresOn) < 0;
    routes.push({ key: `outside:${o.id}`, kind: "outside", label: `Sell to ${o.source}`, grossCents: o.cents, taxValueCents: 0, netCents: o.cents, afterPayoffCents: afterPayoff(o.cents, trade.payoffCents), expiresOn: o.expiresOn, expired, contingent: o.contingentOnInspection, dealId: null, rank: null });
  }
  const live = routes.filter((r) => !r.expired && r.netCents !== null).sort((a, b) => b.netCents! - a.netCents!);
  live.forEach((r, i) => (r.rank = i + 1));
  return routes.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || (b.netCents ?? 0) - (a.netCents ?? 0));
}

/* ---------- Overall: each purchase deal with its best trade route ---------- */

export interface OverallRow {
  dealId: string;
  name: string;
  complete: boolean;
  allInCents: number | null;
  /** Net cost if the trade goes to this dealer. */
  netWithTradeCents: number | null;
  /** Net cost if the trade is sold to the best unexpired outside offer. */
  netOutsideCents: number | null;
  bestRoute: "trade" | "outside" | null;
  bestNetCents: number | null;
  rank: number | null;
  /** How much this deal's best net cost trails the overall best. */
  gapToBestCents: number | null;
}

export function compareOverall(reports: DealReport[]): OverallRow[] {
  const rows: OverallRow[] = reports.map((r) => {
    const w = r.trade.netCostWithTrade.value;
    const o = r.trade.netCostOutside.value;
    let bestRoute: OverallRow["bestRoute"] = null;
    let best: number | null = null;
    if (w !== null && (o === null || w <= o)) {
      bestRoute = "trade";
      best = w;
    } else if (o !== null) {
      bestRoute = "outside";
      best = o;
    }
    return { dealId: r.id, name: r.name, complete: r.complete && best !== null, allInCents: r.price.allIn.value, netWithTradeCents: w, netOutsideCents: o, bestRoute, bestNetCents: best, rank: null, gapToBestCents: null };
  });
  const ranked = rows.filter((r) => r.complete).sort((a, b) => a.bestNetCents! - b.bestNetCents!);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
    r.gapToBestCents = r.bestNetCents! - ranked[0]!.bestNetCents!;
  });
  return rows.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}
