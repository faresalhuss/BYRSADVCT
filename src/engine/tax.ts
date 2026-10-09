import { derived, formatApr, input, mulRate, sumKnown } from "./money";
import type { Cents, Derived, DerivationInput, Offer, OfferLine, Sticker, TaxCandidate, TaxRule, TradeProfile } from "./types";

/** Lines that never enter any total: tax lines, rebates, printed discounts, "other" (informational), and add-ons already printed on the sticker. */
export function isInformational(line: OfferLine): boolean {
  if (line.category === "tax" || line.category === "manufacturer_rebate" || line.category === "conditional_rebate" || line.category === "dealer_discount" || line.category === "other") return true;
  if (line.category === "dealer_addon" && line.onSticker) return true;
  return false;
}

export function isTaxable(line: OfferLine, rule: TaxRule): boolean {
  if (isInformational(line)) return false;
  if (line.taxable !== null && line.taxable !== undefined) return line.taxable;
  return rule.taxableByCategory[line.category];
}

/** True when the trade credit applies under this rule and this paperwork. */
export function tradeCreditApplies(rule: TaxRule, trade: TradeProfile): boolean {
  return rule.tradeReducesBase && trade.vinAndOwnerRecorded;
}

export function manufacturerRebatesAfterPrice(offer: Offer): Cents {
  return sumKnown(
    offer.lines
      .filter((l) => l.category === "manufacturer_rebate" && l.applied === "after_price")
      .map((l) => l.cents),
  ).total;
}

export interface BaseOptions {
  /** Start from total SRP instead of the selling price. */
  useSticker?: boolean;
  /** Subtract the trade allowance. */
  includeTrade?: boolean;
  /** Which fee and add-on lines to include: per rule, none, or every non-tax line. */
  lines?: "rule" | "none" | "all";
  /** Drop dealer add-ons (used for the "without the carbon program" view). */
  excludeAddons?: boolean;
  /** Subtract manufacturer rebates applied after price. */
  includeRebates?: boolean;
}

export interface BaseResult {
  cents: Cents | null;
  inputs: DerivationInput[];
  formula: string;
  /** Labels of selected lines that have no amount yet; when non-empty, cents is null. */
  unknown: string[];
}

export function taxableBase(
  offer: Offer,
  sticker: Sticker,
  rule: TaxRule,
  trade: TradeProfile,
  opts: BaseOptions = {},
): BaseResult {
  const useSticker = opts.useSticker ?? false;
  const includeTrade = opts.includeTrade ?? tradeCreditApplies(rule, trade);
  const lineMode = opts.lines ?? "rule";
  const includeRebates = opts.includeRebates ?? rule.rebatesReduceBase;

  const inputs: DerivationInput[] = [];
  const parts: string[] = [];
  const unknown: string[] = [];
  const start = useSticker ? sticker.totalSrpCents : offer.sellingPriceCents;
  if (start === null) return { cents: null, inputs, formula: useSticker ? "total SRP" : "selling price", unknown: [useSticker ? "total SRP" : "selling price"] };
  inputs.push(input(useSticker ? "Total SRP" : "Selling price", start, "cents", useSticker ? "sticker" : "typed"));
  parts.push(useSticker ? "total SRP" : "selling price");
  let base = start;

  const candidates = offer.lines.filter((l) => {
    if (isInformational(l)) return false;
    if (opts.excludeAddons && l.category === "dealer_addon") return false;
    if (lineMode === "none") return false;
    if (lineMode === "all") return true;
    return isTaxable(l, rule);
  });
  for (const l of candidates) {
    inputs.push(input(l.label, l.cents, "cents", l.source));
    parts.push(l.label);
    if (l.cents === null) {
      unknown.push(l.label);
      continue;
    }
    base += l.cents;
  }

  if (includeTrade) {
    if (offer.tradeAllowanceCents !== null) {
      base -= offer.tradeAllowanceCents;
      inputs.push(input("Trade allowance", offer.tradeAllowanceCents, "cents", "worksheet"));
      parts.push("- trade allowance");
    }
  }

  if (includeRebates) {
    const rebates = manufacturerRebatesAfterPrice(offer);
    if (rebates !== 0) {
      base -= rebates;
      inputs.push(input("Manufacturer rebates (after price)", rebates, "cents", "worksheet"));
      parts.push("- manufacturer rebates");
    }
  }

  return { cents: unknown.length > 0 ? null : Math.max(base, 0), inputs, formula: parts.join(" + ").replace(/\+ -/g, "-"), unknown };
}

export function statedTaxCents(offer: Offer): Cents | null {
  const lines = offer.lines.filter((l) => l.category === "tax");
  if (lines.length === 0) return null;
  const s = sumKnown(lines.map((l) => l.cents));
  return s.unknown > 0 ? null : s.total;
}

export interface TaxAudit {
  taxableBase: Derived;
  computedTax: Derived;
  computedTaxNoAddons: Derived;
  statedTax: Derived;
  difference: Derived;
  candidates: TaxCandidate[];
  likelyError: TaxCandidate | null;
}

function nearlyEqual(a: Cents, b: Cents): boolean {
  return Math.abs(a - b) <= 1;
}

export function auditTax(offer: Offer, sticker: Sticker, rule: TaxRule, trade: TradeProfile): TaxAudit {
  const correct = taxableBase(offer, sticker, rule, trade);
  const rateInput = input(`${rule.name} rate`, rule.rate, "rate", "setting");

  const taxableBaseD = derived("tax.base", "Taxable base", correct.cents, "cents", correct.formula, correct.inputs, correct.unknown.length > 0 ? `Not yet quoted: ${correct.unknown.join(", ")}` : undefined);
  const rateText = formatApr(rule.rate, 2);
  const computed = correct.cents === null ? null : mulRate(correct.cents, rule.rate, rule.ratePrecision);
  const computedTax = derived(
    "tax.computed",
    `Computed ${rule.name}`,
    computed,
    "cents",
    `taxable base x ${rateText} (rounded half up to the cent)`,
    [input("Taxable base", correct.cents, "cents", "computed"), rateInput],
  );

  const noAddons = taxableBase(offer, sticker, rule, trade, { excludeAddons: true });
  const computedNoAddons = noAddons.cents === null ? null : mulRate(noAddons.cents, rule.rate, rule.ratePrecision);
  const computedTaxNoAddons = derived(
    "tax.computedNoAddons",
    `Computed ${rule.name} without dealer add-ons`,
    computedNoAddons,
    "cents",
    `(${noAddons.formula}) x ${rateText}`,
    [...noAddons.inputs, rateInput],
  );

  const stated = statedTaxCents(offer);
  const statedTax = derived("tax.stated", "Dealer's stated tax", stated, "cents", "tax line(s) on the worksheet", [
    input("Stated tax", stated, "cents", "worksheet"),
  ]);
  const difference = derived(
    "tax.difference",
    "Tax difference",
    stated === null || computed === null ? null : stated - computed,
    "cents",
    "stated tax - computed tax",
    [input("Stated tax", stated, "cents", "worksheet"), input("Computed tax", computed, "cents", "computed")],
    "Positive means the dealer charged more than the rule computes.",
  );

  const candidateDefs: { code: string; label: string; opts: BaseOptions }[] = [
    { code: "correct", label: "Correct base (selling price + taxable fees - trade)", opts: {} },
    { code: "no_trade_credit", label: "No trade credit", opts: { includeTrade: false } },
    { code: "sticker_no_trade", label: "Sticker price instead of selling price, no trade credit", opts: { useSticker: true, includeTrade: false } },
    { code: "sticker_with_trade", label: "Sticker price instead of selling price", opts: { useSticker: true } },
    { code: "no_fees_no_trade", label: "Selling price only, fees excluded, no trade credit", opts: { lines: "none", includeTrade: false } },
    { code: "no_fees_with_trade", label: "Selling price only, fees excluded", opts: { lines: "none" } },
    { code: "all_fees_no_trade", label: "Every fee included (even non-taxable), no trade credit", opts: { lines: "all", includeTrade: false } },
    { code: "all_fees_with_trade", label: "Every fee included (even non-taxable)", opts: { lines: "all" } },
  ];
  // The audit only runs when the correct base is fully known; a candidate whose base equals the
  // correct base is not an "error" and is dropped so it can never be blamed.
  const candidates: TaxCandidate[] = [];
  if (correct.cents !== null) {
    for (const def of candidateDefs) {
      const b = taxableBase(offer, sticker, rule, trade, def.opts);
      if (b.cents === null) continue;
      if (def.code !== "correct" && b.cents === correct.cents) continue;
      const t = mulRate(b.cents, rule.rate, rule.ratePrecision);
      candidates.push({ code: def.code, label: def.label, baseCents: b.cents, taxCents: t, matches: stated !== null && nearlyEqual(stated, t) });
    }
  }
  const correctMatches = candidates.some((c) => c.code === "correct" && c.matches);
  const likelyError = stated === null || correctMatches ? null : (candidates.find((c) => c.matches && c.code !== "correct") ?? null);

  return { taxableBase: taxableBaseD, computedTax, computedTaxNoAddons, statedTax, difference, candidates, likelyError };
}

/** Days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  return Math.round(ms / 86_400_000);
}

export function ruleIsStale(rule: TaxRule, today: string, staleDays: number): boolean {
  return daysBetween(rule.verifiedOn, today) > staleDays;
}
