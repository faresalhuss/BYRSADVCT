import type { CompareMode, CompareResult, CompareRow, DealReport, Unit } from "./types";

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
