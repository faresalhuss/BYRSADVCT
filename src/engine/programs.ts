import { derived, formatCents, input } from "./money";
import type { Cents, DealReport, Flag, Offer, OfferLine, RebateProgram, Settings } from "./types";

/**
 * Rebate programs the buyer qualifies for (ticked in Settings) and whether each deal applies them.
 * An applied program becomes a manufacturer-rebate line deducted after the selling price.
 */

function programLineId(p: RebateProgram): string {
  return `program:${p.id}`;
}

/** Lines to merge into the offer for programs the deal applies. Source is "setting" so derivations show where they came from. */
export function programLines(offer: Offer, settings: Settings): OfferLine[] {
  const applied = new Set(offer.appliedPrograms ?? []);
  const dealType = offer.dealType ?? "purchase";
  return settings.programs
    .filter((p) => applied.has(p.id) && p.appliesTo.includes(dealType))
    .map((p) => ({
      id: programLineId(p),
      label: p.label,
      cents: p.amountCents,
      category: "manufacturer_rebate" as const,
      taxable: null,
      source: "setting" as const,
      applied: "after_price" as const,
      condition: p.eligibility,
      note: p.requiresTfsFinancing ? "Requires financing through Toyota Financial Services." : undefined,
    }));
}

export function analyzePrograms(offer: Offer, settings: Settings, today: string): DealReport["programs"] & { flags: Flag[] } {
  const dealType = offer.dealType ?? "purchase";
  const appliedIds = new Set(offer.appliedPrograms ?? []);
  const applied: { program: RebateProgram; amountCents: Cents }[] = [];
  const missing: RebateProgram[] = [];
  const flags: Flag[] = [];
  let n = 0;
  for (const p of settings.programs) {
    if (!p.appliesTo.includes(dealType)) continue;
    const expired = p.endsOn !== null && p.endsOn < today;
    if (appliedIds.has(p.id)) {
      applied.push({ program: p, amountCents: p.amountCents });
      if (expired) {
        n += 1;
        flags.push({ id: `program-${n}`, code: "program_expired", severity: "caution", title: `${p.label} program ended on ${p.endsOn}`, detail: "Confirm with the dealer that the program is still honored, or untick it on this deal.", impactCents: p.amountCents });
      }
      continue;
    }
    if (!p.eligible || expired) continue;
    // Eligible, current, and not applied: is there already a matching rebate line typed on the worksheet?
    const typed = offer.lines.some((l) => l.category === "manufacturer_rebate" || l.category === "conditional_rebate" ? l.label.toLowerCase().includes(p.label.toLowerCase().split(" ")[0] ?? "") : false);
    if (typed) continue;
    missing.push(p);
    n += 1;
    flags.push({
      id: `program-${n}`,
      code: "program_missing",
      severity: "caution",
      title: `You qualify for ${p.label} (${formatCents(p.amountCents, { cents: false })}) and this deal does not include it`,
      detail: `${p.eligibility}${p.requiresTfsFinancing ? " Requires TFS financing." : ""}${p.stacksWithSpecialApr ? "" : " Cannot be combined with special APR offers."} Ask the dealer to add it after the selling price, then tick it on this deal.`,
      impactCents: p.amountCents,
    });
  }
  const total = applied.reduce((s, a) => s + a.amountCents, 0);
  const appliedTotal = derived(
    "programs.applied",
    "Rebate programs applied",
    total,
    "cents",
    applied.length ? applied.map((a) => a.program.label).join(" + ") : "none applied",
    applied.map((a) => input(a.program.label, a.amountCents, "cents", "setting")),
    "Deducted after the selling price. Tax treatment follows the active rule's rebate setting.",
  );
  return { applied, missing, appliedTotal, flags };
}
