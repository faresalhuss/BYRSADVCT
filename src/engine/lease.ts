import { derived, formatApr, formatCents, input, mulRate, roundHalfUp } from "./money";
import type { Cents, Derived, Flag, LeaseTerms, LeaseTaxRule, Settings } from "./types";

/**
 * Lease economics. A lease payment has two parts: depreciation (what the car loses
 * over the term, spread monthly) and the rent charge (the lessor's interest, priced
 * as a "money factor"). Money factor x 2400 is the equivalent APR.
 */

export interface LeaseInputs {
  lease: LeaseTerms;
  /** Total SRP or MSRP the residual percentage is applied to when residual is given as a percent. */
  residualBasisCents: Cents | null;
  /** Negotiated purchase selling price on the same unit, if there is one, to judge the cap cost against. */
  purchaseSellingPriceCents: Cents | null;
  taxRule: LeaseTaxRule;
  settings: Settings;
}

export interface LeaseReport {
  present: boolean;
  grossCapCost: Derived;
  capReductions: Derived;
  adjustedCapCost: Derived;
  residual: Derived;
  depreciationMonthly: Derived;
  rentChargeMonthly: Derived;
  basePayment: Derived;
  effectiveApr: Derived;
  impliedMoneyFactor: Derived;
  impliedApr: Derived;
  paymentGap: Derived;
  taxTotal: Derived;
  monthlyWithTax: Derived;
  dueAtSigning: Derived;
  totalCost: Derived;
  costPerMonth: Derived;
  negotiation: LeaseNegotiationItem[];
  flags: Flag[];
}

export interface LeaseNegotiationItem {
  key: string;
  label: string;
  valueText: string;
  negotiable: "yes" | "partly" | "no";
  verdict: "good" | "ok" | "push" | "unknown";
  advice: string;
}

function emptyDerived(id: string, label: string, unit: Derived["unit"] = "cents"): Derived {
  return derived(id, label, null, unit, "no lease terms entered", []);
}

export function analyzeLease(inp: LeaseInputs | null): LeaseReport {
  if (!inp || !inp.lease) {
    return {
      present: false,
      grossCapCost: emptyDerived("lease.grossCap", "Gross capitalized cost"),
      capReductions: emptyDerived("lease.capReductions", "Capitalized cost reductions"),
      adjustedCapCost: emptyDerived("lease.adjCap", "Adjusted capitalized cost"),
      residual: emptyDerived("lease.residual", "Residual value"),
      depreciationMonthly: emptyDerived("lease.depreciation", "Monthly depreciation"),
      rentChargeMonthly: emptyDerived("lease.rent", "Monthly rent charge"),
      basePayment: emptyDerived("lease.basePayment", "Base monthly payment"),
      effectiveApr: emptyDerived("lease.effectiveApr", "Effective APR", "rate"),
      impliedMoneyFactor: emptyDerived("lease.impliedMf", "Implied money factor", "rate"),
      impliedApr: emptyDerived("lease.impliedApr", "Implied APR from quoted payment", "rate"),
      paymentGap: emptyDerived("lease.gap", "Payment gap"),
      taxTotal: emptyDerived("lease.tax", "Lease tax"),
      monthlyWithTax: emptyDerived("lease.monthlyWithTax", "Monthly payment with tax"),
      dueAtSigning: emptyDerived("lease.dueAtSigning", "Due at signing"),
      totalCost: emptyDerived("lease.totalCost", "Total cost of the lease"),
      costPerMonth: emptyDerived("lease.costPerMonth", "All-in cost per month"),
      negotiation: [],
      flags: [],
    };
  }
  const { lease: L, settings, taxRule } = inp;
  const flags: Flag[] = [];
  let n = 0;
  const push = (f: Omit<Flag, "id">) => {
    n += 1;
    flags.push({ id: `lease-flag-${n}`, ...f });
  };

  const acqCapitalized = L.acquisitionFeeCapitalized ? (L.acquisitionFeeCents ?? 0) : 0;
  const grossCents = L.agreedValueCents === null ? null : L.agreedValueCents + (L.capitalizedFeesCents ?? 0) + acqCapitalized;
  const grossCapCost = derived(
    "lease.grossCap",
    "Gross capitalized cost",
    grossCents,
    "cents",
    "agreed value + capitalized fees" + (L.acquisitionFeeCapitalized ? " + acquisition fee" : ""),
    [
      input("Agreed value (cap cost)", L.agreedValueCents, "cents", "worksheet"),
      input("Capitalized fees", L.capitalizedFeesCents ?? 0, "cents", "worksheet"),
      ...(L.acquisitionFeeCapitalized ? [input("Acquisition fee (capitalized)", L.acquisitionFeeCents, "cents", "worksheet")] : []),
    ],
    "The agreed value is the lease's selling price. It is as negotiable as a purchase price.",
  );

  const reductionsCents = (L.capReductionCashCents ?? 0) + (L.capReductionRebatesCents ?? 0) + (L.capReductionTradeCents ?? 0);
  const capReductions = derived("lease.capReductions", "Capitalized cost reductions", reductionsCents, "cents", "cash down + rebates applied + trade equity applied", [
    input("Cash cap reduction", L.capReductionCashCents ?? 0, "cents", "worksheet"),
    input("Rebates applied", L.capReductionRebatesCents ?? 0, "cents", "worksheet"),
    input("Trade equity applied", L.capReductionTradeCents ?? 0, "cents", "worksheet"),
  ]);

  const adjCents = grossCents === null ? null : grossCents - reductionsCents;
  const adjustedCapCost = derived("lease.adjCap", "Adjusted capitalized cost", adjCents, "cents", "gross capitalized cost - reductions", [
    input("Gross capitalized cost", grossCents, "cents", "computed"),
    input("Reductions", reductionsCents, "cents", "computed"),
  ]);

  let residualCents: Cents | null = L.residualCents ?? null;
  let residualFormula = "stated residual value";
  const residualInputs = [input("Residual value", L.residualCents ?? null, "cents", "worksheet")];
  if (residualCents === null && L.residualPercent !== null && L.residualPercent !== undefined && inp.residualBasisCents !== null) {
    residualCents = mulRate(inp.residualBasisCents, L.residualPercent, 4);
    residualFormula = `residual percent x ${formatCents(inp.residualBasisCents)} (total SRP)`;
    residualInputs.length = 0;
    residualInputs.push(input("Residual percent", L.residualPercent, "ratio", "worksheet"), input("Residual basis (total SRP)", inp.residualBasisCents, "cents", "sticker"));
  }
  const residual = derived("lease.residual", "Residual value", residualCents, "cents", residualFormula, residualInputs, "Set by the lessor. Not negotiable; a higher residual lowers the payment but raises the buyout.");

  const term = L.termMonths ?? null;
  const depCents = adjCents === null || residualCents === null || term === null || term <= 0 ? null : roundHalfUp((adjCents - residualCents) / term);
  const depreciationMonthly = derived("lease.depreciation", "Monthly depreciation", depCents, "cents", "(adjusted cap cost - residual) / term", [
    input("Adjusted cap cost", adjCents, "cents", "computed"),
    input("Residual", residualCents, "cents", "computed"),
    input("Term", term, "months", "worksheet"),
  ]);

  const mf = L.moneyFactor ?? null;
  const rentCents = adjCents === null || residualCents === null || mf === null ? null : roundHalfUp((adjCents + residualCents) * mf);
  const rentChargeMonthly = derived("lease.rent", "Monthly rent charge", rentCents, "cents", "(adjusted cap cost + residual) x money factor", [
    input("Adjusted cap cost", adjCents, "cents", "computed"),
    input("Residual", residualCents, "cents", "computed"),
    input("Money factor", mf, "rate", "worksheet"),
  ]);

  const baseCents = depCents === null || rentCents === null ? null : depCents + rentCents;
  const basePayment = derived("lease.basePayment", "Base monthly payment", baseCents, "cents", "depreciation + rent charge (before tax)", [
    input("Monthly depreciation", depCents, "cents", "computed"),
    input("Monthly rent charge", rentCents, "cents", "computed"),
  ]);

  // APR as a decimal: money factor x 2400 gives percent, so x 24 gives the decimal rate.
  const effApr = mf === null ? null : mf * 24;
  const effectiveApr = derived("lease.effectiveApr", "Effective APR of the money factor", effApr, "rate", "money factor x 2400 (as a percent)", [input("Money factor", mf, "rate", "worksheet")]);

  // Implied money factor from the quoted (pre-tax) payment.
  let quotedBase: Cents | null = L.quotedPaymentCents ?? null;
  let quotedNote: string | undefined;
  if (quotedBase !== null && L.quotedPaymentIncludesTax && taxRule.basis === "monthly_payment") {
    quotedBase = roundHalfUp(quotedBase / (1 + taxRule.rate));
    quotedNote = "Quoted payment divided by (1 + tax rate) to remove monthly tax.";
  }
  const impliedMf = quotedBase === null || depCents === null || adjCents === null || residualCents === null || adjCents + residualCents === 0 ? null : (quotedBase - depCents) / (adjCents + residualCents);
  const impliedMoneyFactor = derived(
    "lease.impliedMf",
    "Money factor implied by the quoted payment",
    impliedMf === null ? null : Math.round(impliedMf * 1e6) / 1e6,
    "rate",
    "(quoted base payment - depreciation) / (adjusted cap cost + residual)",
    [input("Quoted payment (base)", quotedBase, "cents", "worksheet"), input("Depreciation", depCents, "cents", "computed"), input("Adjusted cap cost + residual", adjCents === null || residualCents === null ? null : adjCents + residualCents, "cents", "computed")],
    quotedNote,
  );
  const impliedApr = derived("lease.impliedApr", "APR implied by the quoted payment", impliedMf === null ? null : Math.round(impliedMf * 24 * 1e7) / 1e7, "rate", "implied money factor x 2400 (as a percent)", [input("Implied money factor", impliedMf, "rate", "computed")]);

  const gapCents = quotedBase === null || baseCents === null ? null : quotedBase - baseCents;
  const paymentGap = derived("lease.gap", "Payment gap", gapCents, "cents", "quoted base payment - computed base payment", [input("Quoted base payment", quotedBase, "cents", "worksheet"), input("Computed base payment", baseCents, "cents", "computed")], "A positive gap means the quote assumes a higher money factor or cap cost than stated.");

  // Tax
  let taxCents: Cents | null = null;
  let taxFormula = "";
  if (L.statedTaxCents !== null && L.statedTaxCents !== undefined) {
    taxCents = L.statedTaxCents;
    taxFormula = "stated on the worksheet";
  } else if (baseCents !== null && term !== null) {
    if (taxRule.basis === "depreciation" && adjCents !== null && residualCents !== null) {
      // Georgia (O.C.G.A. 48-5C-1(a)(1)(E), MV-7L): depreciation + amortized amounts + cash down. Rebates and trade are not "down payments".
      const amortized = L.acquisitionFeeCapitalized ? (L.acquisitionFeeCents ?? 0) : 0;
      const base = Math.max(0, adjCents - residualCents) + amortized + (taxRule.includesCapReductions ? (L.capReductionCashCents ?? 0) : 0);
      taxCents = mulRate(base, taxRule.rate, 4);
      taxFormula = `${formatApr(taxRule.rate, 1)} x ((adjusted cap cost - residual) + capitalized acquisition fee${taxRule.includesCapReductions ? " + cash down" : ""})`;
    } else if (taxRule.basis === "sum_of_payments") {
      const base = baseCents * term + (taxRule.includesCapReductions ? reductionsCents : 0);
      taxCents = mulRate(base, taxRule.rate, 4);
      taxFormula = `${formatApr(taxRule.rate, 1)} x (base payment x term${taxRule.includesCapReductions ? " + cap reductions" : ""})`;
    } else if (taxRule.basis === "monthly_payment") {
      taxCents = mulRate(baseCents, taxRule.rate, 4) * term;
      taxFormula = `${formatApr(taxRule.rate, 1)} x base payment, each month`;
    } else if (taxRule.basis === "agreed_value" && L.agreedValueCents !== null) {
      taxCents = mulRate(L.agreedValueCents, taxRule.rate, 4);
      taxFormula = `${formatApr(taxRule.rate, 1)} x agreed value`;
    }
  }
  const taxTotal = derived("lease.tax", `${taxRule.name} on the lease`, taxCents, "cents", taxFormula || "not computable yet", [input("Base payment", baseCents, "cents", "computed"), input("Term", term, "months", "worksheet"), input(`${taxRule.name} rate`, taxRule.rate, "rate", "setting")], taxRule.notes);

  const monthlyWithTaxCents = baseCents === null ? null : taxRule.basis === "monthly_payment" ? baseCents + mulRate(baseCents, taxRule.rate, 4) : baseCents;
  const monthlyWithTax = derived("lease.monthlyWithTax", "Monthly payment including tax", monthlyWithTaxCents, "cents", taxRule.basis === "monthly_payment" ? "base payment + monthly tax" : "base payment (in Georgia the TAVT is paid at signing or capitalized, not added monthly)", [input("Base payment", baseCents, "cents", "computed")]);

  const dueCents = L.dueAtSigningCents ?? null;
  const dueAtSigning = derived("lease.dueAtSigning", "Due at signing", dueCents, "cents", "as quoted", [input("Due at signing", dueCents, "cents", "worksheet")], "Usually first payment + cap reduction + acquisition fee + doc fee + tax and title.");

  const paymentsCount = term === null ? null : Math.max(0, term - (L.firstPaymentAtSigning ? 1 : 0));
  const taxSeparate = (taxRule.basis === "sum_of_payments" || taxRule.basis === "depreciation" || taxRule.basis === "agreed_value") && !L.taxIncludedInDueAtSigning;
  const totalCents = monthlyWithTaxCents === null || paymentsCount === null || dueCents === null ? null : dueCents + monthlyWithTaxCents * paymentsCount + (L.dispositionFeeCents ?? 0) + (taxSeparate ? (taxCents ?? 0) : 0);
  const totalCost = derived(
    "lease.totalCost",
    "Total cost of the lease (return at end)",
    totalCents,
    "cents",
    "due at signing + remaining monthly payments + disposition fee" + (taxSeparate ? " + lease tax" : ""),
    [input("Due at signing", dueCents, "cents", "worksheet"), input("Monthly payment", monthlyWithTaxCents, "cents", "computed"), input("Remaining payments", paymentsCount, "count", "computed"), input("Disposition fee", L.dispositionFeeCents ?? 0, "cents", "worksheet"), input("Lease tax", taxCents, "cents", "computed")],
  );
  const costPerMonth = derived("lease.costPerMonth", "All-in cost per month", totalCents === null || term === null || term === 0 ? null : roundHalfUp(totalCents / term), "cents", "total cost / term", [input("Total cost", totalCents, "cents", "computed"), input("Term", term, "months", "worksheet")]);

  // Negotiation guidance and flags
  const negotiation: LeaseNegotiationItem[] = [];
  const buyRate = settings.lease.buyRateMoneyFactor;
  if (mf !== null) {
    const markup = buyRate === null ? null : mf - buyRate;
    negotiation.push({
      key: "mf",
      label: "Money factor",
      valueText: `${mf.toFixed(5)} (${formatApr(effApr)} APR)`,
      negotiable: "yes",
      verdict: markup === null ? "unknown" : markup > 0.00002 ? "push" : "good",
      advice: buyRate === null ? "Enter the buy rate from the lease program in Settings to see the markup. Dealers may mark the money factor up; ask for the buy rate." : markup! > 0.00002 ? `Marked up ${(markup! * 2400).toFixed(2)} APR points above the ${buyRate.toFixed(5)} buy rate. Ask for the buy rate.` : "At the buy rate. Nothing to push here.",
    });
    if (markup !== null && markup > 0.00002 && adjCents !== null && residualCents !== null && term !== null) {
      const extra = roundHalfUp((adjCents + residualCents) * markup) * term;
      push({ code: "lease_mf_markup", severity: "flag", title: `Money factor marked up above the buy rate`, detail: `${mf.toFixed(5)} quoted vs ${buyRate!.toFixed(5)} buy rate: about ${formatCents(extra)} of extra rent charge over the term.`, impactCents: extra });
    }
  }
  if (impliedMf !== null && mf !== null && impliedMf - mf > 0.00002 && gapCents !== null && term !== null) {
    push({ code: "lease_payment_gap", severity: "flag", title: "Quoted lease payment is higher than the stated terms produce", detail: `The payment implies a money factor of ${impliedMf.toFixed(5)} (${formatApr(impliedMf * 24)}) against the stated ${mf.toFixed(5)}. Gap ${formatCents(gapCents)} per month, ${formatCents(gapCents * term)} over the term.`, impactCents: gapCents * term });
  }
  if (L.agreedValueCents !== null) {
    const sell = inp.purchaseSellingPriceCents;
    const over = sell === null ? null : L.agreedValueCents - sell;
    negotiation.push({
      key: "cap",
      label: "Agreed value (cap cost)",
      valueText: formatCents(L.agreedValueCents),
      negotiable: "yes",
      verdict: over === null ? "unknown" : over > 0 ? "push" : "good",
      advice: over === null ? "Negotiate this exactly like a purchase price. It should match the best selling price you can get." : over > 0 ? `${formatCents(over)} above the purchase selling price you were quoted. The lease should use the same discounted price.` : "At or below your negotiated selling price.",
    });
    if (over !== null && over > 0) push({ code: "lease_cap_above_price", severity: "flag", title: "Lease agreed value is above the negotiated selling price", detail: `${formatCents(L.agreedValueCents)} vs ${formatCents(sell)}. Every dollar of cap cost is paid for over the term.`, impactCents: over });
  }
  if (residualCents !== null) {
    negotiation.push({ key: "residual", label: "Residual value", valueText: formatCents(residualCents) + (L.residualPercent ? ` (${(L.residualPercent * 100).toFixed(0)}%)` : ""), negotiable: "no", verdict: "ok", advice: "Set by Toyota Financial Services for the term and mileage. Compare terms and mileage tiers instead; a higher residual lowers the payment." });
  }
  if (L.acquisitionFeeCents !== null && L.acquisitionFeeCents !== undefined) {
    const std = settings.lease.standardAcquisitionFeeCents;
    const over = std === null ? null : L.acquisitionFeeCents - std;
    negotiation.push({ key: "acq", label: "Acquisition fee", valueText: formatCents(L.acquisitionFeeCents), negotiable: "partly", verdict: over === null ? "unknown" : over > 0 ? "push" : "ok", advice: over === null ? "The lessor's standard fee is usually fixed, but dealers sometimes mark it up. Enter the standard fee in Settings to check." : over > 0 ? `${formatCents(over)} above the standard fee. Ask for it at the standard amount.` : "At the standard fee." });
    if (over !== null && over > 0) push({ code: "lease_acq_markup", severity: "caution", title: "Acquisition fee above the standard amount", detail: `${formatCents(L.acquisitionFeeCents)} quoted vs ${formatCents(std)} standard.`, impactCents: over });
  }
  if (L.dispositionFeeCents !== null && L.dispositionFeeCents !== undefined) {
    negotiation.push({ key: "disp", label: "Disposition fee", valueText: formatCents(L.dispositionFeeCents), negotiable: "no", verdict: "ok", advice: "Charged only if you return the car. Waived if you buy it out or lease another Toyota, in most programs." });
  }
  if (term !== null && L.milesPerYear) {
    negotiation.push({ key: "miles", label: "Term and mileage", valueText: `${term} months, ${L.milesPerYear.toLocaleString()} miles/year`, negotiable: "yes", verdict: "ok", advice: "Pick the mileage you will actually drive. Buying extra miles up front is cheaper than the per-mile overage charge at return." });
  }
  negotiation.push({ key: "down", label: "Cap cost reduction (money down)", valueText: formatCents(reductionsCents), negotiable: "yes", verdict: reductionsCents > 0 ? "ok" : "good", advice: "Money down on a lease is lost if the car is totaled or stolen early. Prefer a higher payment over a large cap reduction, unless the dealer is applying rebates (which should be cap reductions)." });

  return {
    present: true,
    grossCapCost,
    capReductions,
    adjustedCapCost,
    residual,
    depreciationMonthly,
    rentChargeMonthly,
    basePayment,
    effectiveApr,
    impliedMoneyFactor,
    impliedApr,
    paymentGap,
    taxTotal,
    monthlyWithTax,
    dueAtSigning,
    totalCost,
    costPerMonth,
    negotiation,
    flags,
  };
}

/** Money factor from a decimal APR and back (0.06 APR = 0.0025 money factor). */
export function aprToMoneyFactor(apr: number): number {
  return apr / 24;
}
export function moneyFactorToApr(mf: number): number {
  return mf * 24;
}
