import { describe, expect, it } from "vitest";
import fixture from "../fixtures/golden-4runner.json";
import { DEFAULT_SETTINGS, GEORGIA_TAVT_2026, analyzeLease, compareOverall, compareTradeRoutes, evaluateDeal, moneyFactorToApr, type DealInput, type LeaseTerms, type Offer, type Settings } from "@/engine";

const lease: LeaseTerms = {
  termMonths: 36,
  milesPerYear: 12000,
  agreedValueCents: 5871400,
  capitalizedFeesCents: 69900,
  acquisitionFeeCents: 65000,
  acquisitionFeeCapitalized: true,
  capReductionCashCents: 200000,
  capReductionRebatesCents: 0,
  capReductionTradeCents: 0,
  residualPercent: 0.62,
  residualCents: null,
  moneyFactor: 0.0025,
  quotedPaymentCents: null,
  quotedPaymentIncludesTax: false,
  dueAtSigningCents: 300000,
  firstPaymentAtSigning: true,
  taxIncludedInDueAtSigning: true,
  statedTaxCents: null,
  dispositionFeeCents: 35000,
  lender: "TFS",
};
const settings: Settings = { ...DEFAULT_SETTINGS, lease: { buyRateMoneyFactor: 0.0021, standardAcquisitionFeeCents: 65000, standardDispositionFeeCents: 35000, residuals: [] } };

function base(overrides: Partial<DealInput> = {}): DealInput {
  return {
    id: "l",
    name: "Lease deal",
    sticker: fixture.sticker as DealInput["sticker"],
    vehicle: { vin: fixture.vehicle.vin, year: 2026, make: "Toyota", model: "4Runner", trim: "TRD Off-Road Premium", powertrain: "gas" },
    offer: { ...(fixture.offer as Offer), dealType: "lease", lease },
    trade: fixture.trade as DealInput["trade"],
    taxRule: GEORGIA_TAVT_2026,
    settings,
    today: fixture.today,
    ...overrides,
  };
}

describe("lease math", () => {
  const r = analyzeLease({ lease, residualBasisCents: 6236000, purchaseSellingPriceCents: 5871400, taxRule: GEORGIA_TAVT_2026.lease!, settings });
  it("builds cap cost, residual, depreciation and rent charge", () => {
    expect(r.grossCapCost.value).toBe(5871400 + 69900 + 65000);
    expect(r.adjustedCapCost.value).toBe(5871400 + 69900 + 65000 - 200000);
    expect(r.residual.value).toBe(3866320); // 62% of 62,360
    // depreciation = (58,063 - 38,663.20) / 36 = 538.883 -> 538.88
    expect(r.depreciationMonthly.value).toBe(53888);
    // rent = (58,063 + 38,663.20) x 0.0025 = 241.8155 -> 241.82
    expect(r.rentChargeMonthly.value).toBe(24182);
    expect(r.basePayment.value).toBe(53888 + 24182);
  });
  it("money factor converts to APR and the markup is flagged with its cost", () => {
    expect(r.effectiveApr.value).toBeCloseTo(0.06, 6);
    expect(moneyFactorToApr(0.0025)).toBeCloseTo(0.06, 9);
    const f = r.flags.find((x) => x.code === "lease_mf_markup");
    expect(f).toBeDefined();
    expect(f!.impactCents).toBe(Math.floor((5806300 + 3866320) * 0.0004 + 0.5) * 36);
  });
  it("solves the implied money factor from a quoted payment and flags a gap", () => {
    const quoted = analyzeLease({ lease: { ...lease, quotedPaymentCents: 82000 }, residualBasisCents: 6236000, purchaseSellingPriceCents: 5871400, taxRule: GEORGIA_TAVT_2026.lease!, settings });
    expect(quoted.impliedMoneyFactor.value!).toBeGreaterThan(0.0025);
    expect(quoted.flags.some((x) => x.code === "lease_payment_gap")).toBe(true);
    const honest = analyzeLease({ lease: { ...lease, quotedPaymentCents: 78070 }, residualBasisCents: 6236000, purchaseSellingPriceCents: 5871400, taxRule: GEORGIA_TAVT_2026.lease!, settings });
    expect(Math.abs(honest.impliedMoneyFactor.value! - 0.0025)).toBeLessThan(0.00002);
    expect(honest.flags.some((x) => x.code === "lease_payment_gap")).toBe(false);
  });
  it("computes Georgia lease tax on depreciation plus the capitalized acquisition fee plus cash down (MVD-2021-04)", () => {
    const base = 5806300 - 3866320 + 65000 + 200000;
    expect(r.taxTotal.value).toBe(Math.floor(base * 0.07 + 0.5));
  });
  it("gives negotiation guidance per figure", () => {
    const keys = r.negotiation.map((n) => n.key);
    expect(keys).toEqual(expect.arrayContaining(["mf", "cap", "residual", "acq", "disp", "miles", "down"]));
    expect(r.negotiation.find((n) => n.key === "residual")!.negotiable).toBe("no");
    expect(r.negotiation.find((n) => n.key === "mf")!.verdict).toBe("push");
  });
  it("is part of the deal report for lease deals and absent for purchases", () => {
    const rep = evaluateDeal(base());
    expect(rep.dealType).toBe("lease");
    expect(rep.lease.present).toBe(true);
    expect(rep.flags.some((f) => f.code === "lease_mf_markup")).toBe(true);
    const purchase = evaluateDeal(base({ offer: fixture.offer as Offer }));
    expect(purchase.lease.present).toBe(false);
  });
});

describe("rebate programs", () => {
  const programs: Settings["programs"] = [
    { id: "college", label: "College Graduate Rebate", amountCents: 50000, eligibility: "Graduated within the last two years or will within six months; financed through TFS.", eligible: true, requiresTfsFinancing: true, stacksWithSpecialApr: true, appliesTo: ["purchase", "lease"], sourceUrl: "https://example.test", verifiedOn: "2026-10-09", endsOn: null },
    { id: "military", label: "Military Rebate", amountCents: 50000, eligibility: "Active duty, reserve, retired, or veteran within two years.", eligible: false, requiresTfsFinancing: true, stacksWithSpecialApr: true, appliesTo: ["purchase"], sourceUrl: "https://example.test", verifiedOn: "2026-10-09", endsOn: null },
  ];
  const s: Settings = { ...DEFAULT_SETTINGS, programs };
  it("flags an eligible program the deal does not include, and stays quiet for ineligible ones", () => {
    const r = evaluateDeal(base({ settings: s, offer: fixture.offer as Offer }));
    const f = r.flags.filter((x) => x.code === "program_missing");
    expect(f.length).toBe(1);
    expect(f[0]!.title).toContain("College Graduate");
    expect(r.programs.missing.map((p) => p.id)).toEqual(["college"]);
  });
  it("applies a ticked program as an after-price rebate that changes the totals", () => {
    const without = evaluateDeal(base({ settings: s, offer: fixture.offer as Offer }));
    const withIt = evaluateDeal(base({ settings: s, offer: { ...(fixture.offer as Offer), appliedPrograms: ["college"] } }));
    expect(withIt.programs.appliedTotal.value).toBe(50000);
    // The 500 rebate comes off the total and, per MV-7D, also takes 35 off the tax.
    expect(withIt.tax.correctedTotal.value).toBe(without.tax.correctedTotal.value! - 50000 - 3500);
    expect(withIt.flags.some((x) => x.code === "program_missing")).toBe(false);
    // Georgia Form MV-7D: a manufacturer rebate reduces the taxable base, so the tax drops by 7% of 500.
    expect(withIt.tax.computedTax.value).toBe(without.tax.computedTax.value! - 3500);
  });
});

describe("trade routes and overall ranking", () => {
  it("ranks dealer allowances (with tax credit) against outside offers", () => {
    const a = evaluateDeal(base({ id: "a", name: "A", offer: fixture.offer as Offer }));
    const b = evaluateDeal(base({ id: "b", name: "B", offer: { ...(fixture.offer as Offer), tradeAllowanceCents: 2300000 } }));
    const routes = compareTradeRoutes([a, b], fixture.trade as DealInput["trade"], GEORGIA_TAVT_2026, fixture.today);
    expect(routes[0]!.label).toBe("Trade to B"); // 23,000 + 1,610 = 24,610 beats 23,500 outside
    expect(routes[0]!.netCents).toBe(2461000);
    expect(routes.find((r) => r.kind === "outside")!.rank).toBe(2);
    expect(routes.find((r) => r.label === "Trade to A")!.rank).toBe(3);
    // After payoff: net minus the 14,000 loan balance in the fixture.
    expect(routes[0]!.afterPayoffCents).toBe(2461000 - 1400000);
    const noPayoff = compareTradeRoutes([a], { ...(fixture.trade as DealInput["trade"]), payoffCents: null }, GEORGIA_TAVT_2026, fixture.today);
    expect(noPayoff[0]!.afterPayoffCents).toBeNull();
  });
  it("overall picks each deal's best route and ranks by net cost", () => {
    const a = evaluateDeal(base({ id: "a", name: "A", offer: fixture.offer as Offer }));
    const b = evaluateDeal(base({ id: "b", name: "B", offer: { ...(fixture.offer as Offer), sellingPriceCents: 5800000 } }));
    const rows = compareOverall([a, b]);
    expect(rows[0]!.dealId).toBe("b");
    expect(rows[0]!.bestRoute).toBe("outside"); // outside offer 23,500 beats 21,500 + 1,505
    expect(rows[0]!.gapToBestCents).toBe(0);
    // 714 lower selling price plus 7% less tax on the no-trade base (49.98) = 763.98
    expect(rows[1]!.gapToBestCents).toBe(76398);
  });
});
