import { amortizedPayment } from "./finance";
import { formatApr, formatCents } from "./money";
import { daysBetween, ruleIsStale } from "./tax";
import { checkVin } from "./vin";
import type { DealInput, DealReport, Flag, VehicleDecoded, VehicleEntered } from "./types";

export interface FlagContext {
  input: DealInput;
  sticker: DealReport["sticker"];
  price: DealReport["price"];
  tax: DealReport["tax"];
  trade: DealReport["trade"];
  financing: DealReport["financing"];
  revisionDiff: DealReport["revisionDiff"];
}

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function vinDecodeMismatches(entered: VehicleEntered, decoded: VehicleDecoded | null | undefined): string[] {
  if (!decoded) return [];
  const out: string[] = [];
  if (entered.year !== null && decoded.modelYear !== null && entered.year !== decoded.modelYear) {
    out.push(`Year: you entered ${entered.year}, VIN decodes to ${decoded.modelYear}`);
  }
  if (entered.make && decoded.make && norm(entered.make) !== norm(decoded.make)) {
    out.push(`Make: you entered ${entered.make}, VIN decodes to ${decoded.make}`);
  }
  if (entered.model && decoded.model) {
    const a = norm(entered.model);
    const b = norm(decoded.model);
    if (!a.includes(b) && !b.includes(a)) out.push(`Model: you entered ${entered.model}, VIN decodes to ${decoded.model}`);
  }
  if (entered.trim && decoded.trim) {
    const a = norm(entered.trim);
    const b = norm(decoded.trim);
    if (!a.includes(b) && !b.includes(a)) out.push(`Trim: you entered ${entered.trim}, VIN decodes to ${decoded.trim}`);
  }
  if (entered.powertrain) {
    const wantsHybrid = /hybrid|i-?force\s*max|phev|electric/i.test(entered.powertrain);
    const decodedText = `${decoded.fuelType ?? ""} ${decoded.engine ?? ""}`;
    const decodedHybrid = /hybrid|electric|phev/i.test(decodedText);
    if (decodedText.trim() !== "" && wantsHybrid !== decodedHybrid) {
      out.push(`Powertrain: you entered ${entered.powertrain}, VIN decodes to ${decodedText.trim()}`);
    }
  }
  return out;
}

export function computeFlags(ctx: FlagContext): Flag[] {
  const { input, sticker, price, tax, trade, financing, revisionDiff } = ctx;
  const { offer, settings, taxRule, today } = input;
  const flags: Flag[] = [];
  let n = 0;
  const push = (f: Omit<Flag, "id">) => {
    n += 1;
    flags.push({ id: `flag-${n}`, ...f });
  };

  // VIN
  const vin = checkVin(input.vehicle.vin);
  if (vin && !vin.valid) {
    push({ code: "vin_invalid", severity: "flag", title: "VIN check digit is invalid", detail: vin.reason ?? "The VIN does not pass the check-digit test.", impactCents: null });
  }
  const mismatches = vinDecodeMismatches(input.vehicle, input.decoded);
  if (mismatches.length > 0) {
    push({ code: "vin_decode_mismatch", severity: "caution", title: "VIN decode contradicts what you entered", detail: mismatches.join(". "), impactCents: null });
  }

  // Sticker
  if (sticker.reconciles === false) {
    push({
      code: "sticker_mismatch",
      severity: "flag",
      title: "Sticker line items do not sum to total SRP",
      detail: `Line items sum to ${formatCents(sticker.lineSum.value)}; the sticker prints ${formatCents(sticker.totalSrp.value)}.`,
      impactCents: sticker.discrepancy.value,
    });
  }

  // Payment-only quote
  const hasPaymentInfo = offer.paymentGrid.length > 0 || offer.financing.some((f) => f.paymentCents !== null) || (offer.statedBalanceCents ?? null) !== null;
  if (offer.sellingPriceCents === null && hasPaymentInfo) {
    push({
      code: "payment_only_quote",
      severity: "flag",
      title: "Quote given only as a payment or balance",
      detail: "There is no itemized selling price. Ask for an itemized out-the-door quote before discussing payments.",
      impactCents: null,
    });
  }

  // Tax
  if (tax.likelyError) {
    push({
      code: "tax_wrong_base",
      severity: "flag",
      title: tax.likelyError.code === "no_trade_credit" ? "Tax computed without the trade credit" : "Tax computed on the wrong base",
      detail: `The dealer's ${formatCents(tax.statedTax.value)} equals ${formatApr(taxRule.rate, 1)} of ${formatCents(tax.likelyError.baseCents)} (${tax.likelyError.label.toLowerCase()}). Correct ${taxRule.name} is ${formatApr(taxRule.rate, 1)} of ${formatCents(tax.taxableBase.value)} = ${formatCents(tax.computedTax.value)}.`,
      impactCents: tax.difference.value,
      relatedIds: ["tax.stated", "tax.computed"],
    });
  } else if (tax.statedTax.value !== null && tax.difference.value !== null && Math.abs(tax.difference.value) > 1) {
    push({
      code: "tax_differs",
      severity: "caution",
      title: "Stated tax differs from the computed tax",
      detail: `The dealer's ${formatCents(tax.statedTax.value)} does not match ${formatCents(tax.computedTax.value)} and does not match any common wrong base. Ask how it was calculated.`,
      impactCents: tax.difference.value,
    });
  }
  if (ruleIsStale(taxRule, today, settings.taxRuleStaleDays)) {
    push({
      code: "tax_rule_reverify",
      severity: "info",
      title: "Tax rule needs re-verification",
      detail: `${taxRule.name} was last verified on ${taxRule.verifiedOn}, more than ${settings.taxRuleStaleDays} days ago.`,
      impactCents: null,
    });
  }
  const rebates = offer.lines.filter((l) => l.category === "manufacturer_rebate");
  if (rebates.length > 0 && !taxRule.rebateRuleVerified) {
    push({
      code: "rebate_tax_rule_unverified",
      severity: "info",
      title: "Rebate tax treatment is unverified",
      detail: "Whether manufacturer rebates reduce the taxable base has not been confirmed against Georgia DOR Form MV-7D.",
      impactCents: null,
    });
  }

  // Revision pattern
  if (revisionDiff && revisionDiff.tradeAllowanceDelta !== null && revisionDiff.tradeAllowanceDelta > 0) {
    const ups: string[] = [];
    let impact = 0;
    if (revisionDiff.sellingPriceDelta !== null && revisionDiff.sellingPriceDelta > 0) {
      ups.push(`selling price up ${formatCents(revisionDiff.sellingPriceDelta)}`);
      impact += revisionDiff.sellingPriceDelta;
    }
    if (revisionDiff.dealerChargesDelta !== null && revisionDiff.dealerChargesDelta > 0) {
      ups.push(`dealer fees and add-ons up ${formatCents(revisionDiff.dealerChargesDelta)}`);
      impact += revisionDiff.dealerChargesDelta;
    }
    if (revisionDiff.aprDelta !== null && revisionDiff.aprDelta > 0) {
      ups.push(`APR up ${(revisionDiff.aprDelta * 100).toFixed(2)} points`);
    }
    if (ups.length > 0) {
      push({
        code: "trade_up_price_up",
        severity: "flag",
        title: "Trade allowance went up while the deal got worse elsewhere",
        detail: `Allowance up ${formatCents(revisionDiff.tradeAllowanceDelta)}, but ${ups.join(", ")}. The move is being paid for inside the deal.`,
        impactCents: impact > 0 ? impact : null,
      });
    }
  }

  // Add-ons and junk fees
  const junk = settings.junkFeeList.map(norm).filter((s) => s.length > 0);
  for (const line of price.addonLines) {
    const isJunk = junk.some((j) => norm(line.label).includes(j));
    push({
      code: isJunk ? "junk_fee" : "addon_not_on_sticker",
      severity: isJunk ? "flag" : "caution",
      title: isJunk ? `Junk fee: ${line.label}` : `Dealer add-on not on the sticker: ${line.label}`,
      detail: isJunk
        ? `"${line.label}" matches your junk-fee list. Ask for it removed.`
        : `"${line.label}" is not on the window sticker. It is negotiable.`,
      impactCents: line.cents,
      relatedIds: [`line:${line.id}`],
    });
  }
  for (const line of offer.lines) {
    if (line.category !== "dealer_fee") continue;
    const isJunk = junk.some((j) => norm(line.label).includes(j));
    if (isJunk) {
      push({ code: "junk_fee", severity: "flag", title: `Junk fee: ${line.label}`, detail: `"${line.label}" matches your junk-fee list.`, impactCents: line.cents, relatedIds: [`line:${line.id}`] });
    }
  }

  // Rebates
  for (const r of rebates) {
    if (r.applied === "in_price") {
      push({
        code: "rebate_absorbed",
        severity: "flag",
        title: `Manufacturer rebate absorbed into the discount: ${r.label}`,
        detail: "A manufacturer rebate is paid by the automaker and should come off on top of the negotiated price, not inside the dealer's discount.",
        impactCents: r.cents,
        relatedIds: [`line:${r.id}`],
      });
    } else if (r.applied === null || r.applied === undefined) {
      push({ code: "rebate_unclear", severity: "info", title: `Where is the rebate applied: ${r.label}`, detail: "Mark whether this rebate is deducted after the selling price or folded into it.", impactCents: null });
    }
  }

  // Payment gap
  for (const q of financing.quotes) {
    if (q.gap.value !== null && q.gap.value > 1) {
      push({
        code: "payment_gap",
        severity: "flag",
        title: `Quoted payment is higher than the stated APR produces${q.lender ? ` (${q.lender})` : ""}`,
        detail: `Quoted ${formatCents(q.quotedPayment.value)} vs computed ${formatCents(q.computedPayment.value)} at ${formatApr(q.apr)} over ${q.termMonths} months. The gap implies ${formatCents(q.hiddenPrincipal.value)} of hidden principal.`,
        impactCents: q.hiddenPrincipal.value,
      });
    }
  }

  // Grid APR vs pre-approval and promo rates
  for (const row of financing.grid) {
    if (row.impliedApr === null) continue;
    const first = row.cells.find((c) => c.impliedApr !== null);
    const principal = first?.principalCents ?? null;
    const interestDiff = (lowerApr: number) => {
      if (principal === null || principal <= 0) return null;
      const pHigh = amortizedPayment(principal, row.impliedApr!, row.termMonths);
      const pLow = amortizedPayment(principal, lowerApr, row.termMonths);
      return (pHigh - pLow) * row.termMonths;
    };
    if (settings.preApprovalApr !== null && row.impliedApr > settings.preApprovalApr + 0.0005) {
      push({
        code: "grid_apr_above_preapproval",
        severity: "flag",
        title: `${row.termMonths}-month grid implies ${formatApr(row.impliedApr)}, above your ${formatApr(settings.preApprovalApr)} pre-approval`,
        detail: `Over ${row.termMonths} months that costs about ${formatCents(interestDiff(settings.preApprovalApr))} more in interest than your pre-approval.`,
        impactCents: interestDiff(settings.preApprovalApr),
      });
    }
    for (const promo of settings.promoRates) {
      if (promo.termMonths !== null && promo.termMonths !== row.termMonths) continue;
      if (row.impliedApr > promo.apr + 0.0005) {
        push({
          code: "grid_apr_above_promo",
          severity: "flag",
          title: `${row.termMonths}-month grid implies ${formatApr(row.impliedApr)}, above the ${formatApr(promo.apr)} ${promo.label}`,
          detail: `Published promo rate (${promo.source}, as of ${promo.asOf}). Over ${row.termMonths} months the difference is about ${formatCents(interestDiff(promo.apr))} in interest.`,
          impactCents: interestDiff(promo.apr),
        });
      }
    }
    if (row.consistent === false) {
      push({
        code: "grid_inconsistent",
        severity: "caution",
        title: `${row.termMonths}-month grid cells imply different APRs`,
        detail: row.cells.map((c) => `$${(c.cashDownCents / 100).toLocaleString()} down: ${formatApr(c.impliedApr)}`).join(", "),
        impactCents: null,
      });
    }
  }

  // Trade below break-even
  if (trade.breakEvenAllowance.value !== null && trade.allowance.value !== null && trade.allowance.value < trade.breakEvenAllowance.value) {
    push({
      code: "trade_below_breakeven",
      severity: "flag",
      title: "Trade allowance is below break-even against your outside offer",
      detail: `The dealer's ${formatCents(trade.allowance.value)} is worth ${formatCents(trade.effectiveValue.value)} after the tax credit; the outside offer of ${formatCents(trade.bestOutsideOffer?.cents ?? null)} wins by ${formatCents(trade.margin.value === null ? null : -trade.margin.value)}. Break-even allowance is ${formatCents(trade.breakEvenAllowance.value)}.`,
      impactCents: trade.margin.value === null ? null : -trade.margin.value,
    });
  }

  // Expiry
  if (offer.quoteExpiresOn && daysBetween(today, offer.quoteExpiresOn) < 0) {
    push({ code: "quote_expired", severity: "flag", title: "This quote has expired", detail: `Quote expired on ${offer.quoteExpiresOn}.`, impactCents: null });
  }
  for (const o of input.trade.outsideOffers) {
    if (o.expiresOn && daysBetween(today, o.expiresOn) < 0) {
      push({ code: "outside_offer_expired", severity: "caution", title: `Outside offer from ${o.source} has expired`, detail: `Expired on ${o.expiresOn}. It is excluded from the trade comparison.`, impactCents: null });
    }
  }
  if (input.trade.payoffGoodThrough && daysBetween(today, input.trade.payoffGoodThrough) < 0) {
    push({ code: "payoff_expired", severity: "caution", title: "Payoff quote is past its good-through date", detail: `Payoff was good through ${input.trade.payoffGoodThrough}. Get a fresh payoff from the lender.`, impactCents: null });
  }

  // Benchmarks
  for (const b of input.benchmarks ?? []) {
    if (daysBetween(b.observedOn, today) > settings.benchmarkStaleDays) {
      push({ code: "benchmark_stale", severity: "info", title: `Benchmark from ${b.source} is older than ${settings.benchmarkStaleDays} days`, detail: `Observed ${b.observedOn}.`, impactCents: null });
    }
  }

  return flags;
}
