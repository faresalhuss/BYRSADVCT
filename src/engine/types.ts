/**
 * Engine types. Pure data, no framework or I/O.
 *
 * Money is integer cents end to end. Rates are decimals (0.07 = 7%) with an
 * explicit `precision` (decimal places) wherever they are multiplied against money.
 * `null` means "not yet known". It is never treated as zero.
 */

export type Cents = number;

/** Where a number came from. Every input carries one. */
export type Source = "typed" | "sticker" | "worksheet" | "assumption" | "setting" | "computed";

export type Unit = "cents" | "rate" | "ratio" | "months" | "count" | "text" | "date";

export interface DerivationInput {
  label: string;
  value: number | string | null;
  unit: Unit;
  source: Source;
}

/** A number on screen that can be expanded to show how it was derived. */
export interface Derived {
  id: string;
  label: string;
  value: number | null;
  unit: Unit;
  formula: string;
  inputs: DerivationInput[];
  note?: string;
}

/* ---------- Sticker ---------- */

export type StickerGroup = "base" | "factory_option" | "distributor_option" | "dph";

export interface StickerLine {
  id: string;
  label: string;
  cents: Cents | null;
  group: StickerGroup;
  source: Source;
  note?: string;
}

export interface Sticker {
  lines: StickerLine[];
  /** Bottom line printed on the sticker. */
  totalSrpCents: Cents | null;
  /** Optional printed subtotals used to show reconciliation. */
  factoryMsrpCents?: Cents | null;
  distributorOptionsTotalCents?: Cents | null;
}

/* ---------- Vehicle ---------- */

export interface VehicleEntered {
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  powertrain: string | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  stockNumber?: string | null;
  stockDate?: string | null; // ISO date
}

/** Normalized subset of an NHTSA vPIC decode, supplied by the caller. */
export interface VehicleDecoded {
  modelYear: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  fuelType: string | null;
  engine: string | null;
  driveType: string | null;
  errorCode?: string | null;
}

/* ---------- Offer ---------- */

export type LineCategory =
  | "dealer_fee"
  | "dealer_addon"
  | "gov_fee"
  | "tax"
  | "manufacturer_rebate"
  | "conditional_rebate"
  | "dealer_discount"
  | "other";

export interface OfferLine {
  id: string;
  label: string;
  cents: Cents | null;
  category: LineCategory;
  /** Whether this line is in the taxable base. `null` = use the category default from the tax rule. */
  taxable: boolean | null;
  source: Source;
  /** True when the item is printed on the window sticker (then it is not a dealer add-on). */
  onSticker?: boolean;
  /** Rebates: `in_price` means the dealer folded it into the selling price; `after_price` means it is deducted on top. */
  applied?: "in_price" | "after_price" | null;
  /** Conditional rebates: what must be true to receive it. */
  condition?: string | null;
  note?: string;
}

export interface FinancingQuote {
  id: string;
  lender: string | null;
  apr: number | null; // decimal, e.g. 0.0499
  termMonths: number | null;
  cashDownCents: Cents | null;
  amountFinancedCents: Cents | null;
  paymentCents: Cents | null;
  source: Source;
}

export interface PaymentGridCell {
  id: string;
  termMonths: number;
  cashDownCents: Cents;
  paymentCents: Cents;
  source: Source;
}

export interface Offer {
  sellingPriceCents: Cents | null;
  /** The dealer's own "discount" line, if printed. */
  statedDiscountCents?: Cents | null;
  lines: OfferLine[];
  tradeAllowanceCents: Cents | null;
  cashDownCents: Cents | null;
  /** The dealer's printed totals, used for audit only. */
  statedTotalCents?: Cents | null;
  statedBalanceCents?: Cents | null;
  financing: FinancingQuote[];
  paymentGrid: PaymentGridCell[];
  /** Principal the grid is based on, if the worksheet states it. Falls back to statedBalanceCents. */
  gridPrincipalCents?: Cents | null;
  quoteExpiresOn?: string | null; // ISO date
}

/* ---------- Trade ---------- */

export interface OutsideOffer {
  id: string;
  source: string;
  cents: Cents;
  expiresOn: string | null; // ISO date
  contingentOnInspection: boolean;
}

export interface TradeProfile {
  payoffCents: Cents | null;
  payoffGoodThrough: string | null; // ISO date
  outsideOffers: OutsideOffer[];
  /** Georgia requires the trade's VIN and owner on the paperwork for the credit. */
  vinAndOwnerRecorded: boolean;
}

/* ---------- Rules and settings ---------- */

export interface TaxRule {
  id: string;
  state: string;
  version: number;
  name: string;
  rate: number;
  ratePrecision: number;
  tradeReducesBase: boolean;
  rebatesReduceBase: boolean;
  rebateRuleVerified: boolean;
  /** Category defaults for whether a line is in the taxable base. */
  taxableByCategory: Record<LineCategory, boolean>;
  sourceUrl: string;
  verifiedOn: string; // ISO date
  notes?: string;
}

export interface PromoRate {
  id: string;
  label: string;
  apr: number;
  termMonths: number | null;
  source: string;
  asOf: string; // ISO date
}

export interface Settings {
  thresholds: {
    /** All-in / total SRP at or below this is strong. */
    strongRatio: number;
    /** At or below this beats the current best. */
    beatsBestRatio: number;
    label: string;
  };
  junkFeeList: string[];
  preApprovalApr: number | null;
  promoRates: PromoRate[];
  benchmarkStaleDays: number;
  taxRuleStaleDays: number;
  /** Tolerance in APR points for cells of one grid row to be "the same APR". */
  gridRowAprTolerance: number;
}

export interface Benchmark {
  id: string;
  source: string;
  url: string | null;
  observedOn: string; // ISO date
  totalSrpCents: Cents | null;
  priceCents: Cents;
  kind: "paid" | "advertised";
  note?: string;
}

/* ---------- Engine input ---------- */

export interface DealInput {
  id: string;
  name: string;
  sticker: Sticker;
  vehicle: VehicleEntered;
  decoded?: VehicleDecoded | null;
  offer: Offer;
  previousOffer?: Offer | null;
  trade: TradeProfile;
  taxRule: TaxRule;
  settings: Settings;
  benchmarks?: Benchmark[];
  /** ISO date for expiry and staleness checks. Injected, never read from the clock. */
  today: string;
}

/* ---------- Engine output ---------- */

export type FlagSeverity = "flag" | "caution" | "info";

export interface Flag {
  id: string;
  code: string;
  severity: FlagSeverity;
  title: string;
  detail: string;
  impactCents: number | null;
  relatedIds?: string[];
}

export interface TaxCandidate {
  code: string;
  label: string;
  baseCents: Cents;
  taxCents: Cents;
  matches: boolean;
}

export interface GridRowAudit {
  termMonths: number;
  cells: {
    id: string;
    cashDownCents: Cents;
    principalCents: Cents;
    paymentCents: Cents;
    impliedApr: number | null;
  }[];
  impliedApr: number | null;
  consistent: boolean | null;
}

export interface FlagEvent {
  code: string;
  fires: boolean;
}

export interface VerdictDriver {
  label: string;
  value: string;
  effect: number;
}

export interface Verdict {
  band: "strong" | "beats_best" | "keep_negotiating" | "incomplete";
  score: number | null;
  headline: string;
  drivers: VerdictDriver[];
  thresholds: { strongRatio: number; beatsBestRatio: number; label: string };
}

export interface Target {
  targetRatio: number;
  targetAllInCents: Cents | null;
  targetSellingPriceCents: Cents | null;
  targetSellingPriceNoAddonsCents: Cents | null;
  gapCents: Cents | null;
}

export interface DealReport {
  id: string;
  name: string;
  complete: boolean;
  missing: string[];
  vin: { valid: boolean | null; checkDigit: string | null; mismatches: string[] };
  sticker: {
    totalSrp: Derived;
    factoryMsrpPlusDph: Derived;
    lineSum: Derived;
    reconciles: boolean | null;
    discrepancy: Derived;
  };
  price: {
    sellingPrice: Derived;
    discountOffSrp: Derived;
    discountPct: Derived;
    vsFactoryMsrpDph: Derived;
    dealerFees: Derived;
    dealerAddons: Derived;
    allIn: Derived;
    allInRatio: Derived;
    allInNoAddons: Derived;
    allInNoAddonsRatio: Derived;
    govFees: Derived;
    otd: Derived;
    otdNoAddons: Derived;
    addonLines: OfferLine[];
    feeLines: OfferLine[];
    govLines: OfferLine[];
  };
  tax: {
    rule: { id: string; name: string; rate: number; sourceUrl: string; verifiedOn: string; stale: boolean; rebateRuleVerified: boolean };
    taxableBase: Derived;
    computedTax: Derived;
    computedTaxNoAddons: Derived;
    statedTax: Derived;
    difference: Derived;
    candidates: TaxCandidate[];
    likelyError: TaxCandidate | null;
    correctedTotal: Derived;
    correctedBalance: Derived;
    correctedBalanceNoAddons: Derived;
  };
  trade: {
    allowance: Derived;
    payoff: Derived;
    equity: Derived;
    taxValue: Derived;
    effectiveValue: Derived;
    bestOutsideOffer: OutsideOffer | null;
    breakEvenAllowance: Derived;
    routeA: Derived; // net value of trading to this dealer
    routeB: Derived; // net value of selling outside, no tax credit
    winner: "trade" | "outside" | "tie" | null;
    margin: Derived;
    ifDealerMatches: Derived; // margin if allowance were raised to the outside offer
    netCostWithTrade: Derived;
    netCostOutside: Derived;
  };
  financing: {
    quotes: {
      id: string;
      lender: string | null;
      apr: number | null;
      termMonths: number | null;
      principal: Derived;
      computedPayment: Derived;
      quotedPayment: Derived;
      gap: Derived;
      hiddenPrincipal: Derived;
      totalInterest: Derived;
    }[];
    grid: GridRowAudit[];
    gridPrincipal: Derived;
  };
  flags: Flag[];
  verdict: Verdict;
  target: Target;
  revisionDiff: RevisionDiff | null;
}

export interface RevisionDiffLine {
  key: string;
  label: string;
  before: number | string | null;
  after: number | string | null;
  unit: Unit;
  change: "added" | "removed" | "changed" | "same";
}

export interface RevisionDiff {
  lines: RevisionDiffLine[];
  tradeAllowanceDelta: Cents | null;
  sellingPriceDelta: Cents | null;
  dealerChargesDelta: Cents | null;
  aprDelta: number | null;
}

export type CompareMode = "price_only" | "with_trade";

export interface CompareRow {
  key: string;
  label: string;
  unit: Unit;
  values: (number | null)[];
  /** Index of the best value, or null if none. */
  bestIndex: number | null;
  lowerIsBetter: boolean;
}

export interface CompareResult {
  mode: CompareMode;
  dealIds: string[];
  names: string[];
  rows: CompareRow[];
  ranking: { dealId: string; rank: number | null; complete: boolean; metricCents: number | null }[];
  /** Which dealer to push, and by how much, to beat the current best. */
  push: { dealId: string; targetCents: Cents; gapCents: Cents }[];
}
