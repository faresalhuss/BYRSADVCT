import { formatCents, formatPercent, ratio } from "./money";
import { daysBetween } from "./tax";

/**
 * Ranking of saved listings (inquiries) so they are called best first.
 *
 * Only facts on the listing are used. A listing is comparable when it has both an advertised
 * price and the sticker (MSRP), because advertised ÷ MSRP is the one number that compares
 * different builds fairly. Listings with a price but no sticker rank below every comparable one,
 * then listings with no price at all. Within a tier, older stock breaks ties (aged inventory is
 * the more motivated seller), and finally the id keeps the order deterministic.
 */

export type InquiryTier = "priced" | "advertised_only" | "unpriced";

export interface InquiryInput {
  id: string;
  status: string;
  advertisedCents: number | null;
  msrpCents: number | null;
  /** ISO date the dealer stocked the unit, if the listing shows it. */
  stockDate: string | null;
}

export interface RankedInquiry {
  id: string;
  /** 1 = call first. Null for converted or dismissed listings. */
  rank: number | null;
  tier: InquiryTier;
  /** advertised ÷ MSRP when both are known. */
  ratio: number | null;
  daysOnLot: number | null;
  /** One sentence a novice can read: why it sits where it sits, or what is missing. */
  reason: string;
}

export const OPEN_INQUIRY_STATUSES = new Set(["to_call", "called"]);

const TIER_ORDER: Record<InquiryTier, number> = { priced: 0, advertised_only: 1, unpriced: 2 };

function tierOf(i: InquiryInput): InquiryTier {
  if (i.advertisedCents !== null && i.msrpCents !== null && i.msrpCents > 0) return "priced";
  if (i.advertisedCents !== null) return "advertised_only";
  return "unpriced";
}

function daysOnLot(i: InquiryInput, today: string): number | null {
  if (!i.stockDate) return null;
  const d = daysBetween(i.stockDate, today);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

function reasonFor(tier: InquiryTier, r: number | null, i: InquiryInput, days: number | null): string {
  const lot = days !== null && days >= 30 ? ` On the lot ${days} days, so the dealer is more motivated.` : "";
  switch (tier) {
    case "priced":
      return `Advertised at ${formatPercent(r)} of MSRP (${formatCents(i.advertisedCents, { cents: false })} against ${formatCents(i.msrpCents, { cents: false })}).${lot}`;
    case "advertised_only":
      return `${formatCents(i.advertisedCents, { cents: false })} advertised, but no MSRP yet. Add the sticker price to rank it against the others.${lot}`;
    default:
      return `No price yet. Add the advertised price and MSRP to rank it.${lot}`;
  }
}

/** Comparator: lower is better. Total order, independent of input order. */
export function compareInquiries(a: InquiryInput, b: InquiryInput, today: string): number {
  const ta = tierOf(a);
  const tb = tierOf(b);
  if (ta !== tb) return TIER_ORDER[ta] - TIER_ORDER[tb];
  if (ta === "priced") {
    const ra = ratio(a.advertisedCents, a.msrpCents)!;
    const rb = ratio(b.advertisedCents, b.msrpCents)!;
    if (ra !== rb) return ra - rb;
  }
  if (ta !== "unpriced" && a.advertisedCents !== b.advertisedCents) return a.advertisedCents! - b.advertisedCents!;
  const da = daysOnLot(a, today) ?? -1;
  const db = daysOnLot(b, today) ?? -1;
  if (da !== db) return db - da;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Ranks open listings best first; closed listings follow, unranked, in the same comparable order. */
export function rankInquiries(rows: InquiryInput[], today: string): RankedInquiry[] {
  const open = rows.filter((r) => OPEN_INQUIRY_STATUSES.has(r.status)).sort((a, b) => compareInquiries(a, b, today));
  const closed = rows.filter((r) => !OPEN_INQUIRY_STATUSES.has(r.status)).sort((a, b) => compareInquiries(a, b, today));
  const describe = (i: InquiryInput, rank: number | null): RankedInquiry => {
    const tier = tierOf(i);
    const r = tier === "priced" ? ratio(i.advertisedCents, i.msrpCents) : null;
    const days = daysOnLot(i, today);
    return { id: i.id, rank, tier, ratio: r, daysOnLot: days, reason: reasonFor(tier, r, i, days) };
  };
  return [...open.map((i, idx) => describe(i, idx + 1)), ...closed.map((i) => describe(i, null))];
}
