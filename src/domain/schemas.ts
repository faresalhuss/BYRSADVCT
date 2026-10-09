import { z } from "zod";
import type {
  Benchmark,
  FinancingQuote,
  LeaseTaxRule,
  LeaseTerms,
  LineCategory,
  RebateProgram,
  Offer,
  OfferLine,
  OutsideOffer,
  PaymentGridCell,
  PromoRate,
  Settings,
  Sticker,
  StickerLine,
  TaxRule,
  TradeProfile,
  VehicleDecoded,
  VehicleEntered,
} from "@/engine/types";

/** Integer cents or null ("not yet quoted"). */
export const centsSchema = z.number().int().min(-1_000_000_000).max(1_000_000_000);
export const centsOrNull = centsSchema.nullable();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const isoDateOrNull = isoDate.nullable();
export const sourceSchema = z.enum(["typed", "sticker", "worksheet", "assumption", "setting", "computed"]);
export const rateSchema = z.number().min(0).max(2);

export const stickerLineSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  cents: centsOrNull,
  group: z.enum(["base", "factory_option", "distributor_option", "dph"]),
  source: sourceSchema,
  note: z.string().max(500).optional(),
}) satisfies z.ZodType<StickerLine>;

export const stickerSchema = z.object({
  lines: z.array(stickerLineSchema).max(60),
  totalSrpCents: centsOrNull,
  factoryMsrpCents: centsOrNull.optional(),
  distributorOptionsTotalCents: centsOrNull.optional(),
}) satisfies z.ZodType<Sticker>;

export const lineCategorySchema = z.enum([
  "dealer_fee",
  "dealer_addon",
  "gov_fee",
  "tax",
  "manufacturer_rebate",
  "conditional_rebate",
  "dealer_discount",
  "other",
]) satisfies z.ZodType<LineCategory>;

export const offerLineSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  cents: centsOrNull,
  category: lineCategorySchema,
  taxable: z.boolean().nullable(),
  source: sourceSchema,
  onSticker: z.boolean().optional(),
  applied: z.enum(["in_price", "after_price"]).nullable().optional(),
  condition: z.string().max(300).nullable().optional(),
  note: z.string().max(500).optional(),
}) satisfies z.ZodType<OfferLine>;

export const financingQuoteSchema = z.object({
  id: z.string().min(1),
  lender: z.string().max(120).nullable(),
  apr: rateSchema.nullable(),
  termMonths: z.number().int().min(1).max(120).nullable(),
  cashDownCents: centsOrNull,
  amountFinancedCents: centsOrNull,
  paymentCents: centsOrNull,
  source: sourceSchema,
}) satisfies z.ZodType<FinancingQuote>;

export const paymentGridCellSchema = z.object({
  id: z.string().min(1),
  termMonths: z.number().int().min(1).max(120),
  cashDownCents: centsSchema,
  paymentCents: centsSchema,
  source: sourceSchema,
}) satisfies z.ZodType<PaymentGridCell>;

export const leaseTermsSchema = z.object({
  termMonths: z.number().int().min(1).max(60).nullable(),
  milesPerYear: z.number().int().min(1000).max(50000).nullable(),
  agreedValueCents: centsOrNull,
  capitalizedFeesCents: centsOrNull,
  acquisitionFeeCents: centsOrNull,
  acquisitionFeeCapitalized: z.boolean(),
  capReductionCashCents: centsOrNull,
  capReductionRebatesCents: centsOrNull,
  capReductionTradeCents: centsOrNull,
  residualPercent: z.number().min(0).max(1).nullable(),
  residualCents: centsOrNull,
  moneyFactor: z.number().min(0).max(0.02).nullable(),
  quotedPaymentCents: centsOrNull,
  quotedPaymentIncludesTax: z.boolean(),
  dueAtSigningCents: centsOrNull,
  firstPaymentAtSigning: z.boolean(),
  taxIncludedInDueAtSigning: z.boolean(),
  statedTaxCents: centsOrNull,
  dispositionFeeCents: centsOrNull,
  lender: z.string().max(120).nullable(),
}) satisfies z.ZodType<LeaseTerms>;

export const offerSchema = z.object({
  sellingPriceCents: centsOrNull,
  statedDiscountCents: centsOrNull.optional(),
  lines: z.array(offerLineSchema).max(60),
  tradeAllowanceCents: centsOrNull,
  cashDownCents: centsOrNull,
  statedTotalCents: centsOrNull.optional(),
  statedBalanceCents: centsOrNull.optional(),
  financing: z.array(financingQuoteSchema).max(12),
  paymentGrid: z.array(paymentGridCellSchema).max(60),
  gridPrincipalCents: centsOrNull.optional(),
  quoteExpiresOn: isoDateOrNull.optional(),
  dealType: z.enum(["purchase", "lease"]).optional(),
  lease: leaseTermsSchema.nullable().optional(),
  appliedPrograms: z.array(z.string().min(1)).max(20).optional(),
}) satisfies z.ZodType<Offer>;

export const vehicleEnteredSchema = z.object({
  vin: z.string().max(20).nullable(),
  year: z.number().int().min(1980).max(2100).nullable(),
  make: z.string().max(60).nullable(),
  model: z.string().max(60).nullable(),
  trim: z.string().max(80).nullable(),
  powertrain: z.string().max(80).nullable(),
  exteriorColor: z.string().max(80).nullable().optional(),
  interiorColor: z.string().max(80).nullable().optional(),
  stockNumber: z.string().max(40).nullable().optional(),
  stockDate: isoDateOrNull.optional(),
}) satisfies z.ZodType<VehicleEntered>;

export const vehicleDecodedSchema = z.object({
  modelYear: z.number().int().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  trim: z.string().nullable(),
  fuelType: z.string().nullable(),
  engine: z.string().nullable(),
  driveType: z.string().nullable(),
  errorCode: z.string().nullable().optional(),
}) satisfies z.ZodType<VehicleDecoded>;

export const outsideOfferSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1).max(120),
  cents: centsSchema,
  expiresOn: isoDateOrNull,
  contingentOnInspection: z.boolean(),
}) satisfies z.ZodType<OutsideOffer>;

export const tradeProfileSchema = z.object({
  payoffCents: centsOrNull,
  payoffGoodThrough: isoDateOrNull,
  outsideOffers: z.array(outsideOfferSchema),
  vinAndOwnerRecorded: z.boolean(),
}) satisfies z.ZodType<TradeProfile>;

/** What is stored in trade_profile.payload (outside offers live in their own table). */
export const tradeProfilePayloadSchema = z.object({
  payoffCents: centsOrNull.default(null),
  payoffGoodThrough: isoDateOrNull.default(null),
  vinAndOwnerRecorded: z.boolean().default(true),
  vehicle: z
    .object({
      vin: z.string().max(20).nullable().optional(),
      year: z.number().int().nullable().optional(),
      description: z.string().max(120).nullable().optional(),
      lender: z.string().max(120).nullable().optional(),
    })
    .default({}),
});

export const taxRuleSchema = z.object({
  id: z.string().min(1),
  state: z.string().length(2),
  version: z.number().int().min(1),
  name: z.string().min(1).max(60),
  rate: rateSchema,
  ratePrecision: z.number().int().min(0).max(8),
  tradeReducesBase: z.boolean(),
  rebatesReduceBase: z.boolean(),
  rebateRuleVerified: z.boolean(),
  taxableByCategory: z.object({
    dealer_fee: z.boolean(),
    dealer_addon: z.boolean(),
    gov_fee: z.boolean(),
    tax: z.boolean(),
    manufacturer_rebate: z.boolean(),
    conditional_rebate: z.boolean(),
    dealer_discount: z.boolean(),
    other: z.boolean(),
  }),
  sourceUrl: z.url(),
  verifiedOn: isoDate,
  notes: z.string().max(2000).optional(),
  lease: z
    .object({
      name: z.string().min(1).max(60),
      rate: rateSchema,
      basis: z.enum(["depreciation", "sum_of_payments", "monthly_payment", "agreed_value"]),
      includesCapReductions: z.boolean(),
      sourceUrl: z.url(),
      verifiedOn: isoDate,
      verified: z.boolean(),
      notes: z.string().max(2000).optional(),
    })
    .optional() satisfies z.ZodType<LeaseTaxRule | undefined>,
}) satisfies z.ZodType<TaxRule>;

export const rebateProgramSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  amountCents: centsSchema,
  eligibility: z.string().max(2000),
  eligible: z.boolean(),
  requiresTfsFinancing: z.boolean(),
  stacksWithSpecialApr: z.boolean(),
  appliesTo: z.array(z.enum(["purchase", "lease"])).min(1),
  sourceUrl: z.string().max(500),
  verifiedOn: isoDate,
  endsOn: isoDateOrNull,
  notes: z.string().max(2000).optional(),
}) satisfies z.ZodType<RebateProgram>;

export const promoRateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  apr: rateSchema,
  termMonths: z.number().int().min(1).max(120).nullable(),
  source: z.string().max(200),
  asOf: isoDate,
}) satisfies z.ZodType<PromoRate>;

export const settingsSchema = z.object({
  thresholds: z.object({
    strongRatio: z.number().min(0.5).max(1.5),
    beatsBestRatio: z.number().min(0.5).max(1.5),
    label: z.string().max(200),
  }),
  junkFeeList: z.array(z.string().max(80)).max(100),
  preApprovalApr: rateSchema.nullable(),
  promoRates: z.array(promoRateSchema).max(20),
  benchmarkStaleDays: z.number().int().min(1).max(3650),
  taxRuleStaleDays: z.number().int().min(1).max(3650),
  gridRowAprTolerance: z.number().min(0).max(0.05),
  lease: z
    .object({
      buyRateMoneyFactor: z.number().min(0).max(0.02).nullable(),
      standardAcquisitionFeeCents: centsOrNull,
      standardDispositionFeeCents: centsOrNull,
      residuals: z.array(z.object({ termMonths: z.number().int(), milesPerYear: z.number().int(), percent: z.number().min(0).max(1), source: z.string().max(200), asOf: isoDate })).max(50),
    })
    .default({ buyRateMoneyFactor: null, standardAcquisitionFeeCents: null, standardDispositionFeeCents: null, residuals: [] }),
  programs: z.array(rebateProgramSchema).max(30).default([]),
}) satisfies z.ZodType<Settings>;

export const settingsPayloadSchema = settingsSchema.extend({
  activeTaxRuleId: z.string().min(1),
});

export const benchmarkSchema = z.object({
  id: z.string().min(1),
  vehicle: z.enum(["purchase", "trade"]).optional(),
  source: z.string().min(1).max(120),
  url: z.url().nullable(),
  observedOn: isoDate,
  totalSrpCents: centsOrNull,
  priceCents: centsSchema,
  kind: z.enum(["paid", "advertised"]),
  note: z.string().max(500).optional(),
}) satisfies z.ZodType<Benchmark>;

export const dealStatusSchema = z.enum(["verbal", "written", "expired"]);

/** Form payload for creating or editing a deal (header + vehicle + sticker + offer). */
export const dealFormSchema = z.object({
  dealershipName: z.string().min(1, "Dealership name is required").max(120),
  dealershipAddress: z.string().max(200).nullable(),
  dealershipPhone: z.string().max(40).nullable(),
  dealershipWebsite: z.string().max(200).nullable(),
  salesperson: z.string().max(120).nullable(),
  status: dealStatusSchema,
  quoteExpiresOn: isoDateOrNull,
  vehicle: vehicleEnteredSchema,
  decoded: vehicleDecodedSchema.nullable(),
  sticker: stickerSchema,
  offer: offerSchema,
  revisionNote: z.string().max(300).nullable(),
  /** Files uploaded through the import panel (under imports/<batch>/), attached to the deal on save. */
  importFiles: z.array(z.object({ path: z.string().regex(/^imports\/[^/]+\/[^/]+$/), name: z.string().max(200), mime: z.string().max(80), bytes: z.number().int().positive() })).max(5).optional(),
});
export type DealForm = z.infer<typeof dealFormSchema>;

export const noteFormSchema = z.object({
  dealId: z.uuid(),
  occurredAt: z.string().min(1),
  who: z.string().max(120).nullable(),
  channel: z.enum(["verbal", "written"]),
  body: z.string().min(1).max(4000),
});

export const outsideOfferFormSchema = z.object({
  source: z.string().min(1).max(120),
  cents: centsSchema,
  expiresOn: isoDateOrNull,
  contingentOnInspection: z.boolean(),
  note: z.string().max(500).nullable(),
});
export const outsideOfferUpdateSchema = outsideOfferFormSchema.extend({ id: z.uuid() });

export const inquiryFormSchema = z.object({
  dealershipName: z.string().min(1, "Dealership name is required").max(120),
  addressLine: z.string().max(200).nullable(),
  city: z.string().max(80).nullable(),
  state: z.string().length(2).nullable(),
  zip: z.string().max(10).nullable(),
  phone: z.string().max(40).nullable(),
  website: z.string().max(300).nullable(),
  listingUrl: z.string().max(500).nullable(),
  salesperson: z.string().max(120).nullable(),
  vehicle: vehicleEnteredSchema,
  advertisedPriceCents: centsOrNull,
  msrpCents: centsOrNull,
  notes: z.string().max(4000).nullable(),
  status: z.enum(["to_call", "called", "converted", "dismissed"]).default("to_call"),
});
export type InquiryForm = z.infer<typeof inquiryFormSchema>;

export const benchmarkFormSchema = z.object({
  vehicle: z.enum(["purchase", "trade"]).default("purchase"),
  source: z.string().min(1).max(120),
  url: z.url().nullable(),
  observedOn: isoDate,
  totalSrpCents: centsOrNull,
  priceCents: centsSchema,
  kind: z.enum(["paid", "advertised"]),
  note: z.string().max(500).nullable(),
});
