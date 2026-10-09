import { auditGrid } from "./financing";
import type { Cents, Offer, RevisionDiff, RevisionDiffLine, Settings, Unit } from "./types";

interface Flat {
  key: string;
  label: string;
  value: number | string | null;
  unit: Unit;
}

function flatten(offer: Offer): Flat[] {
  const out: Flat[] = [
    { key: "sellingPrice", label: "Selling price", value: offer.sellingPriceCents, unit: "cents" },
    { key: "statedDiscount", label: "Stated discount", value: offer.statedDiscountCents ?? null, unit: "cents" },
    { key: "tradeAllowance", label: "Trade allowance", value: offer.tradeAllowanceCents, unit: "cents" },
    { key: "cashDown", label: "Cash down", value: offer.cashDownCents, unit: "cents" },
    { key: "statedTotal", label: "Stated total", value: offer.statedTotalCents ?? null, unit: "cents" },
    { key: "statedBalance", label: "Stated balance", value: offer.statedBalanceCents ?? null, unit: "cents" },
    { key: "quoteExpiresOn", label: "Quote expires", value: offer.quoteExpiresOn ?? null, unit: "date" },
  ];
  for (const l of offer.lines) {
    out.push({ key: `line:${l.id}`, label: l.label, value: l.cents, unit: "cents" });
  }
  for (const f of offer.financing) {
    const who = f.lender ?? "lender";
    out.push({ key: `fin:${f.id}:apr`, label: `${who} APR`, value: f.apr, unit: "rate" });
    out.push({ key: `fin:${f.id}:term`, label: `${who} term`, value: f.termMonths, unit: "months" });
    out.push({ key: `fin:${f.id}:payment`, label: `${who} payment`, value: f.paymentCents, unit: "cents" });
    out.push({ key: `fin:${f.id}:financed`, label: `${who} amount financed`, value: f.amountFinancedCents, unit: "cents" });
  }
  for (const c of offer.paymentGrid) {
    out.push({ key: `grid:${c.termMonths}:${c.cashDownCents}`, label: `Payment ${c.termMonths} mo, $${c.cashDownCents / 100} down`, value: c.paymentCents, unit: "cents" });
  }
  return out;
}

export function diffOffers(before: Offer, after: Offer, settings?: Settings): RevisionDiff {
  const a = new Map(flatten(before).map((f) => [f.key, f]));
  const b = new Map(flatten(after).map((f) => [f.key, f]));
  const keys = new Set([...a.keys(), ...b.keys()]);
  const lines: RevisionDiffLine[] = [];
  for (const key of keys) {
    const x = a.get(key);
    const y = b.get(key);
    const label = y?.label ?? x?.label ?? key;
    const unit = y?.unit ?? x?.unit ?? "text";
    const dc = (p: number | string | null | undefined, q: number | string | null | undefined): Cents | null => (unit === "cents" && typeof p === "number" && typeof q === "number" ? q - p : null);
    if (x && !y) lines.push({ key, label, before: x.value, after: null, unit, change: "removed", deltaCents: null });
    else if (!x && y) lines.push({ key, label, before: null, after: y.value, unit, change: "added", deltaCents: null });
    else if (x && y) lines.push({ key, label, before: x.value, after: y.value, unit, change: x.value === y.value ? "same" : "changed", deltaCents: dc(x.value, y.value) });
  }
  lines.sort((p, q) => p.key.localeCompare(q.key));

  const delta = (x: Cents | null | undefined, y: Cents | null | undefined): Cents | null =>
    x === null || x === undefined || y === null || y === undefined ? null : y - x;

  const charges = (o: Offer): Cents | null => {
    let total = 0;
    for (const l of o.lines) {
      if (l.category !== "dealer_fee" && (l.category !== "dealer_addon" || l.onSticker)) continue;
      if (l.cents === null) return null;
      total += l.cents;
    }
    return total;
  };

  // Rate movement: compare the same quote (by id) across revisions, and the same payment-grid term's implied APR.
  const aprDeltas: number[] = [];
  for (const q of after.financing) {
    const prev = before.financing.find((p) => p.id === q.id);
    if (prev && prev.apr !== null && q.apr !== null) aprDeltas.push(q.apr - prev.apr);
  }
  if (settings) {
    const beforeRows = auditGrid(before, settings);
    const afterRows = auditGrid(after, settings);
    for (const row of afterRows) {
      const prev = beforeRows.find((r) => r.termMonths === row.termMonths);
      if (prev && prev.impliedApr !== null && row.impliedApr !== null) aprDeltas.push(row.impliedApr - prev.impliedApr);
    }
  }

  return {
    lines,
    tradeAllowanceDelta: delta(before.tradeAllowanceCents, after.tradeAllowanceCents),
    sellingPriceDelta: delta(before.sellingPriceCents, after.sellingPriceCents),
    dealerChargesDelta: delta(charges(before), charges(after)),
    aprDelta: aprDeltas.length === 0 ? null : Math.max(...aprDeltas),
  };
}
