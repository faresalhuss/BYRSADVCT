"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { lineCategorySchema, stickerLineSchema, centsOrNull, centsSchema } from "@/domain/schemas";
import type { Offer, OfferLine, Sticker } from "@/engine";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "./database.types";
import type { ActionResult } from "./actions";
import { getDeal, parseOffer, parseSticker, parseVehicle, EMPTY_OFFER } from "./queries";

const payloadSchema = z.object({
  sticker: z.object({ lines: z.array(stickerLineSchema), totalSrpCents: centsOrNull }).nullable(),
  vehicle: z.object({
    vin: z.string().nullable().optional(),
    year: z.number().int().nullable().optional(),
    make: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    trim: z.string().nullable().optional(),
    exteriorColor: z.string().nullable().optional(),
    interiorColor: z.string().nullable().optional(),
    stockNumber: z.string().nullable().optional(),
  }),
  offer: z
    .object({
      sellingPriceCents: centsOrNull,
      statedDiscountCents: centsOrNull,
      tradeAllowanceCents: centsOrNull,
      cashDownCents: centsOrNull,
      statedTotalCents: centsOrNull,
      statedBalanceCents: centsOrNull,
      lines: z.array(z.object({ id: z.string(), label: z.string().min(1), cents: centsOrNull, category: lineCategorySchema })),
      grid: z.array(z.object({ termMonths: z.number().int().positive(), cashDownCents: centsSchema, paymentCents: centsSchema })),
    })
    .nullable(),
  sourceAttachmentId: z.uuid(),
});

/** Applies a confirmed import: replaces the sticker, fills blank vehicle fields, and adds a revision with the worksheet figures. */
export async function applyImport(dealId: string, input: z.infer<typeof payloadSchema>): Promise<ActionResult<{ newRevision: boolean }>> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The import payload was not valid." };
  const p = parsed.data;
  const existing = await getDeal(dealId);
  if (!existing) return { ok: false, error: "Deal not found." };
  const supabase = await createClient();

  // Sticker: only accepted when lines reconcile with the printed total (checked again here).
  let sticker: Sticker = parseSticker(existing.deal.sticker);
  if (p.sticker) {
    const sum = p.sticker.lines.reduce<number | null>((s, l) => (s === null || l.cents === null ? null : s + l.cents), 0);
    if (p.sticker.totalSrpCents === null || sum !== p.sticker.totalSrpCents) return { ok: false, error: "Sticker lines do not reconcile with the printed total; nothing was saved." };
    sticker = { lines: p.sticker.lines, totalSrpCents: p.sticker.totalSrpCents };
  }

  const vehicle = parseVehicle(existing.deal.vehicle);
  const merged = {
    ...vehicle,
    vin: vehicle.vin ?? p.vehicle.vin ?? null,
    year: vehicle.year ?? p.vehicle.year ?? null,
    make: vehicle.make ?? p.vehicle.make ?? null,
    model: vehicle.model ?? p.vehicle.model ?? null,
    trim: vehicle.trim ?? p.vehicle.trim ?? null,
    exteriorColor: vehicle.exteriorColor ?? p.vehicle.exteriorColor ?? null,
    interiorColor: vehicle.interiorColor ?? p.vehicle.interiorColor ?? null,
    stockNumber: vehicle.stockNumber ?? p.vehicle.stockNumber ?? null,
  };

  const { error } = await supabase
    .from("deals")
    .update({ sticker: sticker as unknown as Json, vehicle: merged as unknown as Json })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  let newRevision = false;
  if (p.offer) {
    const base: Offer = existing.latest ? parseOffer(existing.latest.offer) : EMPTY_OFFER;
    const lines: OfferLine[] = p.offer.lines.map((l, i) => ({ id: `imp-${Date.now().toString(36)}-${i}`, label: l.label, cents: l.cents, category: l.category, taxable: null, source: "worksheet", applied: l.category === "manufacturer_rebate" || l.category === "conditional_rebate" ? null : undefined }));
    const offer: Offer = {
      ...base,
      sellingPriceCents: p.offer.sellingPriceCents ?? base.sellingPriceCents,
      statedDiscountCents: p.offer.statedDiscountCents ?? base.statedDiscountCents ?? null,
      tradeAllowanceCents: p.offer.tradeAllowanceCents ?? base.tradeAllowanceCents,
      cashDownCents: p.offer.cashDownCents ?? base.cashDownCents,
      statedTotalCents: p.offer.statedTotalCents ?? base.statedTotalCents ?? null,
      statedBalanceCents: p.offer.statedBalanceCents ?? base.statedBalanceCents ?? null,
      lines: lines.length > 0 ? lines : base.lines,
      paymentGrid: p.offer.grid.length > 0 ? p.offer.grid.map((c) => ({ id: `g-${c.termMonths}-${c.cashDownCents}`, termMonths: c.termMonths, cashDownCents: c.cashDownCents, paymentCents: c.paymentCents, source: "worksheet" as const })) : base.paymentGrid,
    };
    const { data: claims } = await supabase.auth.getClaims();
    const sub = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    const nextNo = (existing.latest?.revision_no ?? 0) + 1;
    const { error: revError } = await supabase.from("deal_revisions").insert({ deal_id: dealId, revision_no: nextNo, offer: offer as unknown as Json, note: `Imported from attachment ${p.sourceAttachmentId}`, created_by: sub });
    if (revError) return { ok: false, error: revError.message };
    newRevision = true;
  }
  revalidatePath("/");
  revalidatePath(`/deals/${dealId}`);
  return { ok: true, data: { newRevision } };
}
