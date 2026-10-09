import { z } from "zod";
import type {
  Benchmark,
  FinancingQuote,
  LineCategory,
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
}) satisfies z.ZodType<TaxRule>;

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
}) satisfies z.ZodType<Settings>;

export const settingsPayloadSchema = settingsSchema.extend({
  activeTaxRuleId: z.string().min(1),
});

export const benchmarkSchema = z.object({
  id: z.string().min(1),
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

export const benchmarkFormSchema = z.object({
  source: z.string().min(1).max(120),
  url: z.url().nullable(),
  observedOn: isoDate,
  totalSrpCents: centsOrNull,
  priceCents: centsSchema,
  kind: z.enum(["paid", "advertised"]),
  note: z.string().max(500).nullable(),
});
