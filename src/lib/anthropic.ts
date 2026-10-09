import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/** True when the server has an Anthropic API key. The key is never sent to the client or logged. */
export function anthropicConfigured(): boolean {
  return typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.length > 0;
}

export const MODEL = "claude-opus-5-5";

const lineGroup = z.enum(["base", "factory_option", "distributor_option", "dph", "unknown"]);
const lineCategory = z.enum(["dealer_fee", "dealer_addon", "gov_fee", "tax", "manufacturer_rebate", "conditional_rebate", "dealer_discount", "other"]);

export const extractionSchema = z.object({
  documentKind: z.enum(["window_sticker", "dealer_worksheet", "buyers_order", "other"]),
  vehicle: z.object({
    vin: z.string().nullable(),
    year: z.number().int().nullable(),
    make: z.string().nullable(),
    model: z.string().nullable(),
    trim: z.string().nullable(),
    modelCode: z.string().nullable(),
    exteriorColor: z.string().nullable(),
    interiorColor: z.string().nullable(),
    stockNumber: z.string().nullable(),
  }),
  sticker: z.object({
    lines: z.array(
      z.object({
        label: z.string(),
        amountDollars: z.number(),
        group: lineGroup,
      }),
    ),
    totalSrpDollars: z.number().nullable(),
    factoryMsrpDollars: z.number().nullable(),
    distributorOptionsTotalDollars: z.number().nullable(),
    dphDollars: z.number().nullable(),
  }),
  offer: z.object({
    sellingPriceDollars: z.number().nullable(),
    statedDiscountDollars: z.number().nullable(),
    tradeAllowanceDollars: z.number().nullable(),
    tradePayoffDollars: z.number().nullable(),
    cashDownDollars: z.number().nullable(),
    statedTotalDollars: z.number().nullable(),
    statedBalanceDollars: z.number().nullable(),
    lines: z.array(
      z.object({
        label: z.string(),
        amountDollars: z.number(),
        category: lineCategory,
      }),
    ),
    paymentGrid: z.array(
      z.object({
        termMonths: z.number().int(),
        cashDownDollars: z.number(),
        paymentDollars: z.number(),
      }),
    ),
  }),
  dealership: z.object({
    name: z.string().nullable(),
    salesperson: z.string().nullable(),
    date: z.string().nullable(),
  }),
  uncertainties: z.array(z.string()),
});
export type Extraction = z.infer<typeof extractionSchema>;

const SYSTEM = `You transcribe car-dealer documents (window stickers, dealer worksheets, buyer's orders) into structured data for a buyer auditing the math.
Rules:
- Copy every printed line item exactly as labeled, with its printed dollar amount. Do not invent, estimate or omit lines. If an amount is unreadable, leave the line out and describe it in uncertainties.
- Window sticker groups: base = base MSRP; factory_option = factory installed options and packages (including $0 items like emissions); distributor_option = distributor or port installed accessories (for example Southeast Toyota or Gulf States Toyota add-ons); dph = delivery, processing and handling (destination). Total SRP is the bottom line.
- Worksheet categories: dealer_fee = doc fee, ELT, electronic filing, dealer services; dealer_addon = anything not on the sticker (protection packages, nitrogen, etch, carbon offset programs, market adjustments); gov_fee = title, registration, tag, lemon law fee; tax = any sales tax, TAVT or "state taxes and fees" line; manufacturer_rebate and conditional_rebate = factory incentives; dealer_discount = a printed discount line; other = anything else.
- Payment grids: one entry per cell, with the term in months, the cash down for that column, and the monthly payment.
- Fill fields that are not on the document with null. Amounts are dollars with cents, no currency symbols.`;

export async function extractDocument(input: { bytes: Buffer; mime: string; kindHint: "sticker" | "worksheet" | "unknown" }): Promise<Extraction> {
  const client = new Anthropic({ timeout: 55_000, maxRetries: 1 });
  const data = input.bytes.toString("base64");
  const block: Anthropic.MessageParam["content"] =
    input.mime === "application/pdf"
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }]
      : [{ type: "image", source: { type: "base64", media_type: input.mime as "image/jpeg" | "image/png" | "image/webp", data } }];
  const hint = input.kindHint === "sticker" ? "This should be a window sticker." : input.kindHint === "worksheet" ? "This should be a dealer worksheet or buyer's order." : "";
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16_000,
    system: SYSTEM,
    messages: [{ role: "user", content: [...block, { type: "text", text: `Transcribe this document. ${hint}`.trim() }] }],
    output_config: { format: zodOutputFormat(extractionSchema) },
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to read this document.");
  if (!response.parsed_output) throw new Error("The model's answer did not match the expected structure.");
  return response.parsed_output;
}
