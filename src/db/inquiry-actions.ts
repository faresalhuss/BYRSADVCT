"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inquiryFormSchema, type InquiryForm } from "@/domain/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./actions";
import type { Json } from "./database.types";
import { getInquiry, getInquiryAttachments, parseVehicle } from "./queries";

async function uid(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

function toRow(f: InquiryForm) {
  return {
    dealership_name: f.dealershipName,
    address_line: f.addressLine,
    city: f.city,
    state: f.state,
    zip: f.zip,
    phone: f.phone,
    website: f.website,
    listing_url: f.listingUrl,
    salesperson: f.salesperson,
    vehicle: f.vehicle as unknown as Json,
    advertised_price_cents: f.advertisedPriceCents,
    msrp_cents: f.msrpCents,
    notes: f.notes,
    status: f.status,
  };
}

export async function createInquiry(input: InquiryForm): Promise<ActionResult<{ id: string }>> {
  const parsed = inquiryFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", issues: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("inquiries").insert({ ...toRow(parsed.data), created_by: await uid() }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save." };
  revalidatePath("/inquire");
  return { ok: true, data: { id: data.id } };
}

export async function updateInquiry(id: string, input: InquiryForm): Promise<ActionResult<{ id: string }>> {
  const parsed = inquiryFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", issues: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) };
  const supabase = await createClient();
  const { error } = await supabase.from("inquiries").update(toRow(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inquire");
  revalidatePath(`/inquire/${id}`);
  return { ok: true, data: { id } };
}

export async function setInquiryStatus(id: string, status: "to_call" | "called" | "dismissed"): Promise<void> {
  const supabase = await createClient();
  await supabase.from("inquiries").update({ status }).eq("id", id);
  revalidatePath("/inquire");
  revalidatePath(`/inquire/${id}`);
}

export async function deleteInquiry(id: string): Promise<void> {
  const supabase = await createClient();
  const atts = await getInquiryAttachments(id);
  if (atts.length) await supabase.storage.from("attachments").remove(atts.flatMap((a) => [a.storage_path, a.thumb_path].filter((p): p is string => !!p)));
  await supabase.from("inquiries").delete().eq("id", id);
  revalidatePath("/inquire");
  redirect("/inquire");
}

/**
 * Turns an inquiry into a deal: dealership and vehicle carry over, the advertised price
 * becomes the first selling price (source: typed, from the listing), and the inquiry's
 * attachments move to the deal so a sticker import can run from the deal.
 */
export async function convertInquiryToDeal(id: string): Promise<void> {
  const inq = await getInquiry(id);
  if (!inq) return;
  const supabase = await createClient();
  const vehicle = parseVehicle(inq.vehicle);
  const address = [inq.address_line, [inq.city, inq.state].filter(Boolean).join(", "), inq.zip].filter((p) => p && String(p).trim()).join(", ");
  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      dealership_name: inq.dealership_name,
      dealership_address: address || null,
      dealership_phone: inq.phone,
      dealership_website: inq.website ?? inq.listing_url,
      salesperson: inq.salesperson,
      status: "verbal",
      vehicle: vehicle as unknown as Json,
      sticker: ({ lines: [], totalSrpCents: inq.msrp_cents === null ? null : Number(inq.msrp_cents) } as unknown) as Json,
      created_by: await uid(),
    })
    .select("id")
    .single();
  if (error || !deal) return;
  const offer = {
    sellingPriceCents: inq.advertised_price_cents === null ? null : Number(inq.advertised_price_cents),
    lines: [],
    tradeAllowanceCents: null,
    cashDownCents: null,
    financing: [],
    paymentGrid: [],
    dealType: "purchase",
  };
  await supabase.from("deal_revisions").insert({ deal_id: deal.id, revision_no: 1, offer: offer as unknown as Json, note: `Converted from inquiry${inq.listing_url ? ` (${inq.listing_url})` : ""}. Selling price is the advertised price until the dealer quotes.`, created_by: await uid() });

  // Move attachments to the deal (storage objects and rows).
  const atts = await getInquiryAttachments(id);
  for (const a of atts) {
    const newPath = a.storage_path.replace(`inquiries/${id}/`, `deals/${deal.id}/`);
    const newThumb = a.thumb_path ? a.thumb_path.replace(`inquiries/${id}/`, `deals/${deal.id}/`) : null;
    const { error: mv } = await supabase.storage.from("attachments").move(a.storage_path, newPath);
    if (mv) continue;
    if (a.thumb_path && newThumb) await supabase.storage.from("attachments").move(a.thumb_path, newThumb);
    await supabase.from("attachments").update({ deal_id: deal.id, inquiry_id: null, storage_path: newPath, thumb_path: newThumb }).eq("id", a.id);
  }
  await supabase.from("inquiries").update({ status: "converted", converted_deal_id: deal.id }).eq("id", id);
  revalidatePath("/");
  revalidatePath("/inquire");
  redirect(`/deals/${deal.id}/edit`);
}
