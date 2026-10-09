import type { Settings, TaxRule } from "./types";

/**
 * Georgia Title Ad Valorem Tax (TAVT), verified against the Georgia DOR page on 2026-10-09.
 * Source: https://dor.georgia.gov/motor-vehicles/vehicle-registration-license-plates/vehicle-taxes-title-ad-valorem-tax-tavt-and
 * The manufacturer-rebate rule is marked unverified until confirmed against Form MV-7D.
 */
export const GEORGIA_TAVT_2026: TaxRule = {
  id: "ga-tavt-2026-v1",
  state: "GA",
  version: 1,
  name: "Georgia TAVT",
  rate: 0.07,
  ratePrecision: 4,
  tradeReducesBase: true,
  rebatesReduceBase: false,
  rebateRuleVerified: false,
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
  sourceUrl: "https://dor.georgia.gov/motor-vehicles/vehicle-registration-license-plates/vehicle-taxes-title-ad-valorem-tax-tavt-and",
  verifiedOn: "2026-10-09",
  notes:
    "Base for a dealer sale = selling price + taxable dealer fees and add-ons - trade allowance (trade VIN and owner recorded). Third-party guides say manufacturer rebates also reduce the base; unverified against Form MV-7D, so off by default. ELT and the lemon-law fee are not taxed.",
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
};
