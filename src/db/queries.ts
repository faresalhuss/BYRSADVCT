import "server-only";
import {
  benchmarkSchema,
  offerSchema,
  settingsPayloadSchema,
  stickerSchema,
  taxRuleSchema,
  tradeProfilePayloadSchema,
  vehicleDecodedSchema,
  vehicleEnteredSchema,
} from "@/domain/schemas";
import { DEFAULT_SETTINGS, GEORGIA_TAVT_2026, evaluateDeal, type Benchmark, type DealInput, type DealReport, type Offer, type OutsideOffer, type Settings, type Sticker, type TaxRule, type TradeProfile, type VehicleDecoded, type VehicleEntered } from "@/engine";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./database.types";

export type DealRow = Tables<"deals">;
export type RevisionRow = Tables<"deal_revisions">;
export type NoteRow = Tables<"deal_notes">;
export type AttachmentRow = Tables<"attachments">;

export const EMPTY_OFFER: Offer = { sellingPriceCents: null, lines: [], tradeAllowanceCents: null, cashDownCents: null, financing: [], paymentGrid: [] };
export const EMPTY_STICKER: Sticker = { lines: [], totalSrpCents: null };
export const EMPTY_VEHICLE: VehicleEntered = { vin: null, year: null, make: null, model: null, trim: null, powertrain: null };

export function parseOffer(json: unknown): Offer {
  const r = offerSchema.safeParse(json);
  return r.success ? r.data : EMPTY_OFFER;
}
export function parseSticker(json: unknown): Sticker {
  const r = stickerSchema.safeParse(json);
  return r.success ? r.data : EMPTY_STICKER;
}
export function parseVehicle(json: unknown): VehicleEntered {
  const r = vehicleEnteredSchema.safeParse(json);
  return r.success ? r.data : EMPTY_VEHICLE;
}
export function parseDecoded(json: unknown): VehicleDecoded | null {
  if (json === null || json === undefined) return null;
  const r = vehicleDecodedSchema.safeParse(json);
  return r.success ? r.data : null;
}

export interface SettingsBundle {
  settings: Settings;
  activeTaxRuleId: string;
  taxRule: TaxRule;
  taxRules: TaxRule[];
}

export async function getSettingsBundle(): Promise<SettingsBundle> {
  const supabase = await createClient();
  const [{ data: settingsRow }, { data: ruleRows }] = await Promise.all([
    supabase.from("settings").select("payload").eq("id", 1).maybeSingle(),
    supabase.from("tax_rules").select("id, payload, active").order("created_at", { ascending: true }),
  ]);
  const parsedSettings = settingsPayloadSchema.safeParse(settingsRow?.payload);
  const payload = parsedSettings.success ? parsedSettings.data : { ...DEFAULT_SETTINGS, activeTaxRuleId: GEORGIA_TAVT_2026.id };
  const { activeTaxRuleId, ...settings } = payload;
  const taxRules: TaxRule[] = [];
  for (const row of ruleRows ?? []) {
    const r = taxRuleSchema.safeParse(row.payload);
    if (r.success) taxRules.push(r.data);
  }
  const taxRule = taxRules.find((r) => r.id === activeTaxRuleId) ?? taxRules.find((r) => r.id === GEORGIA_TAVT_2026.id) ?? GEORGIA_TAVT_2026;
  return { settings, activeTaxRuleId: taxRule.id, taxRule, taxRules: taxRules.length > 0 ? taxRules : [GEORGIA_TAVT_2026] };
}

export interface TradeBundle {
  profile: TradeProfile;
  vehicle: { vin?: string | null; year?: number | null; description?: string | null; lender?: string | null };
  outsideOffers: (OutsideOffer & { note: string | null; createdAt: string })[];
}

export async function getTradeBundle(): Promise<TradeBundle> {
  const supabase = await createClient();
  const [{ data: profileRow }, { data: offerRows }] = await Promise.all([
    supabase.from("trade_profile").select("payload").eq("id", 1).maybeSingle(),
    supabase.from("outside_offers").select("*").order("created_at", { ascending: false }),
  ]);
  const parsed = tradeProfilePayloadSchema.safeParse(profileRow?.payload ?? {});
  const payload = parsed.success ? parsed.data : tradeProfilePayloadSchema.parse({});
  const outsideOffers = (offerRows ?? []).map((o) => ({
    id: o.id,
    source: o.source,
    cents: Number(o.cents),
    expiresOn: o.expires_on,
    contingentOnInspection: o.contingent_on_inspection,
    note: o.note,
    createdAt: o.created_at,
  }));
  return {
    profile: {
      payoffCents: payload.payoffCents,
      payoffGoodThrough: payload.payoffGoodThrough,
      vinAndOwnerRecorded: payload.vinAndOwnerRecorded,
      outsideOffers: outsideOffers.map(({ id, source, cents, expiresOn, contingentOnInspection }) => ({ id, source, cents, expiresOn, contingentOnInspection })),
    },
    vehicle: payload.vehicle,
    outsideOffers,
  };
}

export async function getBenchmarks(): Promise<Benchmark[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("benchmarks").select("*").order("observed_on", { ascending: false });
  const out: Benchmark[] = [];
  for (const row of data ?? []) {
    const r = benchmarkSchema.safeParse({
      id: row.id,
      source: row.source,
      url: row.url,
      observedOn: row.observed_on,
      totalSrpCents: row.total_srp_cents === null ? null : Number(row.total_srp_cents),
      priceCents: Number(row.price_cents),
      kind: row.kind,
      note: row.note ?? undefined,
    });
    if (r.success) out.push(r.data);
  }
  return out;
}

export interface DealWithRevisions {
  deal: DealRow;
  revisions: RevisionRow[]; // newest first
  latest: RevisionRow | null;
  previous: RevisionRow | null;
}

export async function listDeals(opts: { archived?: boolean } = {}): Promise<DealWithRevisions[]> {
  const supabase = await createClient();
  let q = supabase.from("deals").select("*, deal_revisions(*)").order("updated_at", { ascending: false });
  q = opts.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const { deal_revisions, ...deal } = row as DealRow & { deal_revisions: RevisionRow[] };
    const revisions = [...(deal_revisions ?? [])].sort((a, b) => b.revision_no - a.revision_no);
    return { deal, revisions, latest: revisions[0] ?? null, previous: revisions[1] ?? null };
  });
}

export async function getDeal(id: string): Promise<DealWithRevisions | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("*, deal_revisions(*)").eq("id", id).maybeSingle();
  if (!data) return null;
  const { deal_revisions, ...deal } = data as DealRow & { deal_revisions: RevisionRow[] };
  const revisions = [...(deal_revisions ?? [])].sort((a, b) => b.revision_no - a.revision_no);
  return { deal, revisions, latest: revisions[0] ?? null, previous: revisions[1] ?? null };
}

export async function getNotes(dealId: string): Promise<NoteRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("deal_notes").select("*").eq("deal_id", dealId).order("occurred_at", { ascending: false });
  return data ?? [];
}

export async function getAttachments(dealId: string): Promise<AttachmentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("attachments").select("*").eq("deal_id", dealId).order("created_at", { ascending: false });
  return data ?? [];
}

export interface EvalContext {
  settingsBundle: SettingsBundle;
  trade: TradeBundle;
  benchmarks: Benchmark[];
  today: string;
}

export async function getEvalContext(): Promise<EvalContext> {
  const [settingsBundle, trade, benchmarks] = await Promise.all([getSettingsBundle(), getTradeBundle(), getBenchmarks()]);
  return { settingsBundle, trade, benchmarks, today: todayIso() };
}

export function dealName(deal: DealRow): string {
  return deal.dealership_name;
}

export function buildDealInput(d: DealWithRevisions, ctx: EvalContext, revision?: RevisionRow | null): DealInput {
  const current = revision ?? d.latest;
  const idx = current ? d.revisions.findIndex((r) => r.id === current.id) : -1;
  const previous = idx >= 0 ? (d.revisions[idx + 1] ?? null) : null;
  return {
    id: d.deal.id,
    name: dealName(d.deal),
    sticker: parseSticker(d.deal.sticker),
    vehicle: parseVehicle(d.deal.vehicle),
    decoded: parseDecoded(d.deal.decoded),
    offer: current ? parseOffer(current.offer) : EMPTY_OFFER,
    previousOffer: previous ? parseOffer(previous.offer) : null,
    trade: ctx.trade.profile,
    taxRule: ctx.settingsBundle.taxRule,
    settings: ctx.settingsBundle.settings,
    benchmarks: ctx.benchmarks,
    today: ctx.today,
  };
}

export function evaluate(d: DealWithRevisions, ctx: EvalContext, revision?: RevisionRow | null): DealReport {
  return evaluateDeal(buildDealInput(d, ctx, revision));
}
