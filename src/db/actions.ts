"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { benchmarkFormSchema, dealFormSchema, noteFormSchema, outsideOfferFormSchema, settingsPayloadSchema, taxRuleSchema, tradeProfilePayloadSchema, type DealForm } from "@/domain/schemas";
import { createClient } from "@/lib/supabase/server";
import { getDeal, parseOffer, parseSticker } from "./queries";
import type { Json } from "./database.types";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; issues?: Record<string, string> };

function issuesOf(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] = i.message;
  return out;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce((acc: Record<string, unknown>, k) => ((acc[k] = (v as Record<string, unknown>)[k]), acc), {}) : v));
}

/* ---------- Deals ---------- */

export async function createDeal(input: DealForm): Promise<ActionResult<{ id: string }>> {
  const parsed = dealFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", issues: issuesOf(parsed.error) };
  const f = parsed.data;
  const supabase = await createClient();
  const uid = await currentUserId();
  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      dealership_name: f.dealershipName,
      dealership_address: f.dealershipAddress,
      dealership_phone: f.dealershipPhone,
      dealership_website: f.dealershipWebsite,
      salesperson: f.salesperson,
      status: f.status,
      quote_expires_on: f.quoteExpiresOn,
      vehicle: f.vehicle as unknown as Json,
      decoded: f.decoded as unknown as Json,
      sticker: f.sticker as unknown as Json,
      created_by: uid,
    })
    .select("id")
    .single();
  if (error || !deal) return { ok: false, error: error?.message ?? "Could not create the deal." };
  const { error: revError } = await supabase.from("deal_revisions").insert({ deal_id: deal.id, revision_no: 1, offer: f.offer as unknown as Json, note: f.revisionNote, created_by: uid });
  if (revError) return { ok: false, error: revError.message };
  revalidatePath("/");
  return { ok: true, data: { id: deal.id } };
}

export async function updateDeal(id: string, input: DealForm): Promise<ActionResult<{ id: string; newRevision: boolean }>> {
  const parsed = dealFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", issues: issuesOf(parsed.error) };
  const f = parsed.data;
  const existing = await getDeal(id);
  if (!existing) return { ok: false, error: "Deal not found." };
  const supabase = await createClient();
  const uid = await currentUserId();
  const { error } = await supabase
    .from("deals")
    .update({
      dealership_name: f.dealershipName,
      dealership_address: f.dealershipAddress,
      dealership_phone: f.dealershipPhone,
      dealership_website: f.dealershipWebsite,
      salesperson: f.salesperson,
      status: f.status,
      quote_expires_on: f.quoteExpiresOn,
      vehicle: f.vehicle as unknown as Json,
      decoded: f.decoded as unknown as Json,
      sticker: f.sticker as unknown as Json,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  const latestOffer = existing.latest ? parseOffer(existing.latest.offer) : null;
  const changed = latestOffer === null || stable(latestOffer) !== stable(parseOffer(f.offer));
  if (changed) {
    const nextNo = (existing.latest?.revision_no ?? 0) + 1;
    const { error: revError } = await supabase.from("deal_revisions").insert({ deal_id: id, revision_no: nextNo, offer: f.offer as unknown as Json, note: f.revisionNote, created_by: uid });
    if (revError) return { ok: false, error: revError.message };
  }
  revalidatePath("/");
  revalidatePath(`/deals/${id}`);
  return { ok: true, data: { id, newRevision: changed } };
}

export async function duplicateDeal(id: string): Promise<void> {
  const existing = await getDeal(id);
  if (!existing) return;
  const supabase = await createClient();
  const uid = await currentUserId();
  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      dealership_name: `${existing.deal.dealership_name} (copy)`,
      dealership_address: existing.deal.dealership_address,
      dealership_phone: existing.deal.dealership_phone,
      dealership_website: existing.deal.dealership_website,
      salesperson: existing.deal.salesperson,
      status: existing.deal.status,
      quote_expires_on: existing.deal.quote_expires_on,
      vehicle: existing.deal.vehicle,
      decoded: existing.deal.decoded,
      sticker: parseSticker(existing.deal.sticker) as unknown as Json,
      created_by: uid,
    })
    .select("id")
    .single();
  if (error || !deal) return;
  if (existing.latest) {
    await supabase.from("deal_revisions").insert({ deal_id: deal.id, revision_no: 1, offer: existing.latest.offer, note: `Copied from ${existing.deal.dealership_name}`, created_by: uid });
  }
  revalidatePath("/");
  redirect(`/deals/${deal.id}`);
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from("deals").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath("/");
  revalidatePath(`/deals/${id}`);
}

export async function setStatus(id: string, status: "verbal" | "written" | "expired"): Promise<void> {
  const supabase = await createClient();
  await supabase.from("deals").update({ status }).eq("id", id);
  revalidatePath("/");
  revalidatePath(`/deals/${id}`);
}

/* ---------- Notes ---------- */

export async function addNote(input: z.infer<typeof noteFormSchema>): Promise<ActionResult> {
  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the note.", issues: issuesOf(parsed.error) };
  const supabase = await createClient();
  const uid = await currentUserId();
  const { error } = await supabase.from("deal_notes").insert({ deal_id: parsed.data.dealId, occurred_at: parsed.data.occurredAt, who: parsed.data.who, channel: parsed.data.channel, body: parsed.data.body, created_by: uid });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/deals/${parsed.data.dealId}/notes`);
  return { ok: true, data: undefined };
}

export async function deleteNote(id: string, dealId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("deal_notes").delete().eq("id", id);
  revalidatePath(`/deals/${dealId}/notes`);
}

/* ---------- Trade ---------- */

export async function saveTradeProfile(input: z.infer<typeof tradeProfilePayloadSchema>): Promise<ActionResult> {
  const parsed = tradeProfilePayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the trade details.", issues: issuesOf(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("trade_profile").upsert({ id: 1, payload: parsed.data as unknown as Json });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function addOutsideOffer(input: z.infer<typeof outsideOfferFormSchema>): Promise<ActionResult> {
  const parsed = outsideOfferFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the offer.", issues: issuesOf(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("outside_offers").insert({ source: parsed.data.source, cents: parsed.data.cents, expires_on: parsed.data.expiresOn, contingent_on_inspection: parsed.data.contingentOnInspection, note: parsed.data.note });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteOutsideOffer(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("outside_offers").delete().eq("id", id);
  revalidatePath("/", "layout");
}

/* ---------- Settings ---------- */

export async function saveSettings(input: z.infer<typeof settingsPayloadSchema>): Promise<ActionResult> {
  const parsed = settingsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the settings.", issues: issuesOf(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert({ id: 1, payload: parsed.data as unknown as Json });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function saveTaxRule(input: z.infer<typeof taxRuleSchema>, activate: boolean): Promise<ActionResult> {
  const parsed = taxRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the tax rule.", issues: issuesOf(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("tax_rules").upsert({ id: parsed.data.id, payload: parsed.data as unknown as Json, active: activate });
  if (error) return { ok: false, error: error.message };
  if (activate) {
    await supabase.from("tax_rules").update({ active: false }).neq("id", parsed.data.id);
    const { data: s } = await supabase.from("settings").select("payload").eq("id", 1).maybeSingle();
    const current = settingsPayloadSchema.safeParse(s?.payload);
    if (current.success) {
      await supabase.from("settings").upsert({ id: 1, payload: { ...current.data, activeTaxRuleId: parsed.data.id } as unknown as Json });
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/* ---------- Benchmarks ---------- */

export async function addBenchmark(input: z.infer<typeof benchmarkFormSchema>): Promise<ActionResult> {
  const parsed = benchmarkFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the benchmark.", issues: issuesOf(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("benchmarks").insert({ source: parsed.data.source, url: parsed.data.url, observed_on: parsed.data.observedOn, total_srp_cents: parsed.data.totalSrpCents, price_cents: parsed.data.priceCents, kind: parsed.data.kind, note: parsed.data.note });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteBenchmark(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("benchmarks").delete().eq("id", id);
  revalidatePath("/", "layout");
}

/* ---------- Attachments ---------- */

export async function deleteAttachment(id: string, dealId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from("attachments").select("storage_path, thumb_path").eq("id", id).maybeSingle();
  if (data) {
    const paths = [data.storage_path, data.thumb_path].filter((p): p is string => !!p);
    await supabase.storage.from("attachments").remove(paths);
    await supabase.from("attachments").delete().eq("id", id);
  }
  revalidatePath(`/deals/${dealId}/attachments`);
}
