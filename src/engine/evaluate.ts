import { computeFlags, vinDecodeMismatches } from "./flags";
import { analyzeLease } from "./lease";
import { analyzePrograms, programLines } from "./programs";
import { analyzeFinancing } from "./financing";
import { derived, input, sumKnown } from "./money";
import { analyzePrice } from "./price";
import { diffOffers } from "./revisions";
import { analyzeSticker } from "./sticker";
import { auditTax, isInformational, manufacturerRebatesAfterPrice, ruleIsStale, taxableBase } from "./tax";
import { buildTarget } from "./target";
import { analyzeTrade } from "./trade";
import type { Cents, DealInput, DealReport } from "./types";
import { computeVerdict } from "./verdict";
import { checkVin } from "./vin";
import { mulRate } from "./money";

export function missingFields(d: DealInput): string[] {
  const missing: string[] = [];
  if (d.sticker.totalSrpCents === null) missing.push("total SRP");
  if (d.offer.sellingPriceCents === null) missing.push("selling price");
  for (const l of d.offer.lines) {
    if (l.cents === null && l.category !== "conditional_rebate") missing.push(l.label);
  }
  // Unknown is not zero: a quote with no dealer-fee line or no government-fee line has not been itemized yet.
  if (!d.offer.lines.some((l) => l.category === "dealer_fee")) missing.push("dealer fees (doc fee, ELT; enter 0 if none)");
  if (!d.offer.lines.some((l) => l.category === "gov_fee")) missing.push("government fees (title, registration)");
  if (d.offer.tradeAllowanceCents !== null && d.trade.payoffCents === null) missing.push("trade payoff");
  return missing;
}

export function evaluateDeal(dealInput: DealInput): DealReport {
  // Rebate programs ticked on this deal become after-price manufacturer rebate lines.
  const extraLines = programLines(dealInput.offer, dealInput.settings);
  let d: DealInput = extraLines.length > 0 ? { ...dealInput, offer: { ...dealInput.offer, lines: [...dealInput.offer.lines, ...extraLines] } } : dealInput;
  if (d.offer.dealType === "lease" && d.offer.sellingPriceCents === null && d.offer.lease?.agreedValueCents != null) {
    d = { ...d, offer: { ...d.offer, sellingPriceCents: d.offer.lease.agreedValueCents } };
  }
  const sticker = analyzeSticker(d.sticker);
  const tax = auditTax(d.offer, d.sticker, d.taxRule, d.trade);

  const price = analyzePrice({
    offer: d.offer,
    sticker: d.sticker,
    stickerReport: sticker,
    computedTaxCents: tax.computedTax.value,
    computedTaxNoAddonsCents: tax.computedTaxNoAddons.value,
  });

  // Corrected worksheet totals: selling - trade + every non-tax line + computed tax - after-price rebates.
  const nonTaxLines = d.offer.lines.filter((l) => !isInformational(l));
  const nonTax = sumKnown(nonTaxLines.map((l) => l.cents));
  const rebates = manufacturerRebatesAfterPrice(d.offer);
  const correctedTotalCents: Cents | null =
    d.offer.sellingPriceCents === null || nonTax.unknown > 0 || tax.computedTax.value === null
      ? null
      : d.offer.sellingPriceCents - (d.offer.tradeAllowanceCents ?? 0) + nonTax.total + tax.computedTax.value - rebates;
  const correctedTotal = derived(
    "tax.correctedTotal",
    "Corrected total",
    correctedTotalCents,
    "cents",
    "selling price - trade allowance + fees and add-ons + government fees + computed tax - manufacturer rebates",
    [
      input("Selling price", d.offer.sellingPriceCents, "cents", "worksheet"),
      input("Trade allowance", d.offer.tradeAllowanceCents, "cents", "worksheet"),
      ...nonTaxLines.map((l) => input(l.label, l.cents, "cents", l.source)),
      input("Computed tax", tax.computedTax.value, "cents", "computed"),
      ...(rebates !== 0 ? [input("Manufacturer rebates", rebates, "cents", "worksheet")] : []),
    ],
  );
  // With a trade, the payoff is part of the balance and must be known. With no trade there is no payoff to add.
  const hasTrade = d.offer.tradeAllowanceCents !== null;
  const payoff = hasTrade ? d.trade.payoffCents : 0;
  const cashDownKnown = d.offer.cashDownCents !== null;
  const cashDown = d.offer.cashDownCents ?? 0;
  const correctedBalanceCents = correctedTotalCents === null || payoff === null ? null : correctedTotalCents + payoff - cashDown;
  const correctedBalance = derived(
    "tax.correctedBalance",
    "Corrected balance",
    correctedBalanceCents,
    "cents",
    hasTrade ? "corrected total + trade payoff - cash down" : "corrected total - cash down",
    [
      input("Corrected total", correctedTotalCents, "cents", "computed"),
      ...(hasTrade ? [input("Payoff", d.trade.payoffCents, "cents", "typed")] : []),
      input("Cash down", cashDown, "cents", cashDownKnown ? "worksheet" : "assumption"),
    ],
    !cashDownKnown ? "No cash down was entered; assumed 0." : undefined,
  );
  const addons = sumKnown(d.offer.lines.filter((l) => l.category === "dealer_addon" && !isInformational(l)).map((l) => l.cents));
  const correctedBalanceNoAddonsCents =
    correctedBalanceCents === null || addons.unknown > 0 || tax.computedTaxNoAddons.value === null || tax.computedTax.value === null
      ? null
      : correctedBalanceCents - addons.total - (tax.computedTax.value - tax.computedTaxNoAddons.value);
  const correctedBalanceNoAddons = derived(
    "tax.correctedBalanceNoAddons",
    "Corrected balance without dealer add-ons",
    correctedBalanceNoAddonsCents,
    "cents",
    "corrected balance - dealer add-ons - tax on those add-ons",
    [input("Corrected balance", correctedBalanceCents, "cents", "computed"), input("Dealer add-ons", addons.total, "cents", "computed"), input("Tax on add-ons", tax.computedTax.value === null || tax.computedTaxNoAddons.value === null ? null : tax.computedTax.value - tax.computedTaxNoAddons.value, "cents", "computed")],
  );

  // Trade economics need tax with and without the credit.
  const noTradeBase = taxableBase(d.offer, d.sticker, d.taxRule, d.trade, { includeTrade: false });
  const taxNoTrade = noTradeBase.cents === null ? null : mulRate(noTradeBase.cents, d.taxRule.rate, d.taxRule.ratePrecision);
  const govNonTax = sumKnown(price.govLines.map((l) => l.cents));
  const preTaxCost = price.allIn.value === null || govNonTax.unknown > 0 ? null : price.allIn.value + govNonTax.total;
  const trade = analyzeTrade({
    offer: d.offer,
    trade: d.trade,
    rule: d.taxRule,
    today: d.today,
    preTaxCostCents: preTaxCost,
    taxWithTradeCents: tax.computedTax.value,
    taxNoTradeCents: taxNoTrade,
  });

  const financing = analyzeFinancing({ offer: d.offer, settings: d.settings });
  const revisionDiff = d.previousOffer ? diffOffers(d.previousOffer, d.offer, d.settings) : null;

  const programs = analyzePrograms(d.offer, d.settings, d.today);
  const dealType: "purchase" | "lease" = d.offer.dealType === "lease" ? "lease" : "purchase";
  const lease = analyzeLease(
    dealType === "lease" && d.offer.lease
      ? {
          lease: d.offer.lease,
          residualBasisCents: sticker.totalSrp.value,
          purchaseSellingPriceCents: d.offer.sellingPriceCents,
          taxRule: d.taxRule.lease ?? { name: `${d.taxRule.name} (lease)`, rate: d.taxRule.rate, basis: "depreciation", includesCapReductions: true, sourceUrl: d.taxRule.sourceUrl, verifiedOn: d.taxRule.verifiedOn, verified: false },
          settings: d.settings,
        }
      : null,
  );
  const flags = [...computeFlags({ input: d, sticker, price, tax: { ...tax, rule: ruleSummary(d), correctedTotal, correctedBalance, correctedBalanceNoAddons }, trade, financing, revisionDiff }), ...programs.flags, ...lease.flags];
  const missing = missingFields(d);
  if (dealType === "lease") {
    const L = d.offer.lease;
    if (!L || L.agreedValueCents === null) missing.push("lease agreed value");
    if (!L || L.termMonths === null) missing.push("lease term");
    if (!L || L.moneyFactor === null) missing.push("money factor");
    if (!L || (L.residualCents === null && L.residualPercent === null)) missing.push("residual");
  }
  const verdict = computeVerdict(price.allInRatio.value, flags, d.settings, missing);
  const target = buildTarget({
    targetRatio: d.settings.thresholds.strongRatio,
    totalSrpCents: sticker.totalSrp.value,
    sellingPriceCents: d.offer.sellingPriceCents,
    dealerFeesCents: price.dealerFees.value,
    dealerAddonsCents: price.dealerAddons.value,
  });

  const vin = checkVin(d.vehicle.vin);

  return {
    id: d.id,
    name: d.name,
    complete: missing.length === 0 && price.allIn.value !== null,
    missing,
    vin: { valid: vin ? vin.valid : null, checkDigit: vin?.checkDigit ?? null, mismatches: vinDecodeMismatches(d.vehicle, d.decoded) },
    sticker,
    price,
    tax: { rule: ruleSummary(d), ...tax, correctedTotal, correctedBalance, correctedBalanceNoAddons },
    trade,
    financing,
    flags,
    verdict,
    target,
    revisionDiff,
    dealType,
    lease,
    programs: { applied: programs.applied, missing: programs.missing, appliedTotal: programs.appliedTotal },
  };
}

function ruleSummary(d: DealInput): DealReport["tax"]["rule"] {
  const r = d.taxRule;
  return {
    id: r.id,
    name: r.name,
    rate: r.rate,
    sourceUrl: r.sourceUrl,
    verifiedOn: r.verifiedOn,
    stale: ruleIsStale(r, d.today, d.settings.taxRuleStaleDays),
    rebateRuleVerified: r.rebateRuleVerified,
  };
}
