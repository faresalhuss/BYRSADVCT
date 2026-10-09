import type { Settings, TaxRule } from "./types";

/**
 * Georgia Title Ad Valorem Tax (TAVT), verified against the Georgia DOR page on 2026-10-09.
 * Source: https://dor.georgia.gov/motor-vehicles/vehicle-registration-license-plates/vehicle-taxes-title-ad-valorem-tax-tavt-and
 * The manufacturer-rebate rule is marked unverified until confirmed against Form MV-7D.
 */
export const GEORGIA_TAVT_2026: TaxRule = {
  id: "ga-tavt-2026-v2",
  state: "GA",
  version: 2,
  name: "Georgia TAVT",
  rate: 0.07,
  ratePrecision: 4,
  tradeReducesBase: true,
  rebatesReduceBase: true,
  rebateRuleVerified: true,
  taxableByCategory: {
    dealer_fee: true,
    dealer_addon: true,
    gov_fee: false,
    tax: false,
    manufacturer_rebate: false,
    conditional_rebate: false,
    dealer_discount: false,
    other: false,
  },
  sourceUrl: "https://dor.georgia.gov/document/document-document/mv-7d-state-and-local-title-ad-valorem-tax-fees/download",
  verifiedOn: "2026-10-09",
  notes:
    "Form MV-7D (rev. 1-2022): base = new vehicle retail sale price + other taxable fees (labor, freight, delivery, dealer fees, accessories, add-ons, mark-ups; not extended warranties) - manufacturer's rebate - trade-in value. Rate 7% per O.C.G.A. 48-5C-1 and DOR bulletin MVD-2023-02. ELT and the $3 lemon-law fee are government charges, not dealer fees, and are left out of the base here.",
  lease: {
    name: "Georgia TAVT (lease)",
    rate: 0.07,
    basis: "depreciation",
    includesCapReductions: true,
    sourceUrl: "https://dor.georgia.gov/document/document/policy-bulletin-mvd-2021-04-revised-tavt-calculation-leases/download",
    verifiedOn: "2026-10-09",
    verified: true,
    notes: "Since 2022-01-01 (HB 63, O.C.G.A. 48-5C-1(a)(1)(E)): base = total depreciation + amortized amounts + cash down payments; rebates, trade allowances and the rent charge are not taxed (Form MV-7L). Paid at signing or capitalized.",
  },
};

export const DEFAULT_SETTINGS: Settings = {
  thresholds: {
    strongRatio: 0.945,
    beatsBestRatio: 0.957,
    label: "October 2026 Atlanta 4Runner TRD Off-Road Premium targets",
  },
  junkFeeList: [
    "nitrogen",
    "vin etch",
    "etch",
    "paint protection",
    "fabric protection",
    "carbon neutral",
    "market adjustment",
    "addendum",
    "dealer prep",
    "protection package",
    "pin stripe",
    "pinstripe",
  ],
  preApprovalApr: null,
  promoRates: [],
  benchmarkStaleDays: 30,
  taxRuleStaleDays: 180,
  gridRowAprTolerance: 0.0005,
  lease: { buyRateMoneyFactor: null, standardAcquisitionFeeCents: null, standardDispositionFeeCents: null, residuals: [] },
  programs: [],
};
