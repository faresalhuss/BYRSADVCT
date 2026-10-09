"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MoneyInput } from "@/components/editor/money-input";
import { Viewer } from "@/app/(app)/deals/[id]/attachments/viewer";
import { applyImport } from "@/db/import-actions";
import type { Extraction } from "@/lib/anthropic";
import { formatCents, reconcileOfferLines, reconcileStickerLines, roundHalfUp, type LineCategory, type Offer, type Sticker, type StickerLine, type VehicleEntered } from "@/engine";

interface Props {
  dealId: string;
  attachment: { id: string; mime: string; kind: string; name: string };
  current: { sticker: Sticker; vehicle: VehicleEntered; offer: Offer };
}

type StickerDraft = { lines: StickerLine[]; totalSrpCents: number | null };
type OfferDraft = {
  sellingPriceCents: number | null;
  statedDiscountCents: number | null;
  tradeAllowanceCents: number | null;
  cashDownCents: number | null;
  statedTotalCents: number | null;
  statedBalanceCents: number | null;
  lines: { id: string; label: string; cents: number | null; category: LineCategory }[];
  grid: { termMonths: number; cashDownCents: number; paymentCents: number }[];
};

const toCents = (d: number | null) => (d === null ? null : roundHalfUp(d * 100));

export function ImportReview({ dealId, attachment, current }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [sticker, setSticker] = useState<StickerDraft | null>(null);
  const [offer, setOffer] = useState<OfferDraft | null>(null);
  const [vehicle, setVehicle] = useState<Partial<VehicleEntered>>({});
  const [applySticker, setApplySticker] = useState(true);
  const [applyOffer, setApplyOffer] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [pending, start] = useTransition();
  const isImage = attachment.mime.startsWith("image/");

  async function extract() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/sticker", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attachmentId: attachment.id, kindHint: attachment.kind === "sticker" ? "sticker" : attachment.kind === "worksheet" ? "worksheet" : "unknown" }),
      });
      const json = (await res.json()) as { extraction?: Extraction; error?: string };
      if (!res.ok || !json.extraction) throw new Error(json.error ?? "Extraction failed");
      const x = json.extraction;
      setExtraction(x);
      setSticker({
        lines: x.sticker.lines.map((l, i) => ({ id: `imp-s-${i}`, label: l.label, cents: toCents(l.amountDollars), group: l.group === "unknown" ? "factory_option" : l.group, source: "sticker" as const })),
        totalSrpCents: toCents(x.sticker.totalSrpDollars),
      });
      setOffer({
        sellingPriceCents: toCents(x.offer.sellingPriceDollars),
        statedDiscountCents: toCents(x.offer.statedDiscountDollars),
        tradeAllowanceCents: toCents(x.offer.tradeAllowanceDollars),
        cashDownCents: toCents(x.offer.cashDownDollars),
        statedTotalCents: toCents(x.offer.statedTotalDollars),
        statedBalanceCents: toCents(x.offer.statedBalanceDollars),
        lines: x.offer.lines.map((l, i) => ({ id: `imp-o-${i}`, label: l.label, cents: toCents(l.amountDollars), category: l.category })),
        grid: x.offer.paymentGrid.flatMap((c) => {
          const payment = toCents(c.paymentDollars);
          const down = toCents(c.cashDownDollars);
          return payment === null || down === null ? [] : [{ termMonths: c.termMonths, cashDownCents: down, paymentCents: payment }];
        }),
      });
      setVehicle({
        vin: x.vehicle.vin,
        year: x.vehicle.year,
        make: x.vehicle.make,
        model: x.vehicle.model,
        trim: x.vehicle.trim,
        exteriorColor: x.vehicle.exteriorColor,
        interiorColor: x.vehicle.interiorColor,
        stockNumber: x.vehicle.stockNumber,
      });
      setApplySticker(x.sticker.lines.length > 0);
      setApplyOffer(x.offer.lines.length > 0 || x.offer.sellingPriceDollars !== null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  // Reconciliation is decided by the engine, never here.
  const stickerCheck = useMemo(() => (sticker ? reconcileStickerLines(sticker.lines, sticker.totalSrpCents) : null), [sticker]);
  const stickerSum = stickerCheck?.sumCents ?? null;
  const stickerReconciles = stickerCheck?.reconciles ?? false;
  const offerCheck = useMemo(() => (offer ? reconcileOfferLines(offer) : null), [offer]);
  const offerSum = offerCheck?.sumCents ?? null;
  const offerHasData = offerCheck?.hasData ?? false;
  const offerReconciles = offerCheck?.reconciles ?? false;

  const canApply = (applySticker && stickerReconciles) || (applyOffer && offerReconciles);
  const blocked = (applySticker && sticker !== null && !stickerReconciles) || (applyOffer && offerHasData && !offerReconciles);

  function apply() {
    if (!sticker || !offer) return;
    start(async () => {
      const res = await applyImport(dealId, {
        sticker: applySticker && stickerReconciles ? { lines: sticker.lines, totalSrpCents: sticker.totalSrpCents } : null,
        vehicle,
        offer: applyOffer && offerReconciles ? offer : null,
        sourceAttachmentId: attachment.id,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/deals/${dealId}`);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="card overflow-hidden">
        <button type="button" className="block w-full bg-surface-2" onClick={() => setViewerOpen(true)} aria-label={`Open ${attachment.name} full screen`}>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL via redirect
            <img src={`/api/attachments/${attachment.id}/file`} alt={attachment.name} className="max-h-[70vh] w-full object-contain" />
          ) : (
            <iframe src={`/api/attachments/${attachment.id}/file`} title={attachment.name} className="h-[70vh] w-full bg-white" />
          )}
        </button>
        <p className="p-2 text-xs text-ink-2">Tap to open full screen and pinch to zoom.</p>
      </div>
      {viewerOpen && <Viewer id={attachment.id} mime={attachment.mime} name={attachment.name} onClose={() => setViewerOpen(false)} />}

      <div className="flex flex-col gap-4">
        {!extraction && (
          <div className="card p-4">
            <p className="text-sm text-ink-2">The document is sent to Claude with a strict schema for line items. The result is shown here for you to check before anything is saved.</p>
            <button type="button" className="btn btn-primary mt-3" onClick={extract} disabled={busy}>
              {busy ? "Reading document" : "Extract line items"}
            </button>
            {error && (
              <p className="mt-2 text-sm text-flag" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        {extraction && sticker && offer && (
          <>
            {extraction.uncertainties.length > 0 && (
              <div className="rounded-md bg-caution-bg p-3 text-sm text-caution">
                <p className="font-medium">The model was unsure about:</p>
                <ul className="list-disc pl-5">
                  {extraction.uncertainties.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            <section className="card p-4">
              <label className="tap flex items-center gap-2 text-lg">
                <input type="checkbox" checked={applySticker} onChange={(e) => setApplySticker(e.target.checked)} />
                Window sticker ({sticker.lines.length} lines)
              </label>
              {sticker.lines.length === 0 ? (
                <p className="mt-2 text-sm text-ink-2">No sticker lines found on this document.</p>
              ) : (
                <>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {sticker.lines.map((l) => (
                        <tr key={l.id} className="border-t border-line/70">
                          <td className="py-1 pr-2">
                            <input aria-label="Line label" className="field" value={l.label} onChange={(e) => setSticker((s) => s && { ...s, lines: s.lines.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) })} />
                          </td>
                          <td className="py-1 pr-2">
                            <select aria-label="Group" className="field" value={l.group} onChange={(e) => setSticker((s) => s && { ...s, lines: s.lines.map((x) => (x.id === l.id ? { ...x, group: e.target.value as StickerLine["group"] } : x)) })}>
                              <option value="base">Base MSRP</option>
                              <option value="factory_option">Factory option</option>
                              <option value="distributor_option">Distributor option</option>
                              <option value="dph">DPH</option>
                            </select>
                          </td>
                          <td className="w-36 py-1">
                            <MoneyInput compact label={`${l.label} amount`} value={l.cents} onChange={(c) => setSticker((s) => s && { ...s, lines: s.lines.map((x) => (x.id === l.id ? { ...x, cents: c } : x)) })} />
                          </td>
                          <td className="py-1 pl-1">
                            <button type="button" className="btn btn-quiet btn-sm" aria-label={`Remove ${l.label}`} onClick={() => setSticker((s) => s && { ...s, lines: s.lines.filter((x) => x.id !== l.id) })}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <MoneyInput label="Total SRP (printed)" value={sticker.totalSrpCents} onChange={(c) => setSticker((s) => s && { ...s, totalSrpCents: c })} />
                    <p className="self-end text-sm">
                      Lines sum to <span className="num">{formatCents(stickerSum)}</span>.{" "}
                      {stickerReconciles ? <span className="pill pill-good">reconciles</span> : <span className="pill pill-flag">does not reconcile</span>}
                    </p>
                  </div>
                </>
              )}
            </section>

            <section className="card p-4">
              <label className="tap flex items-center gap-2 text-lg">
                <input type="checkbox" checked={applyOffer} onChange={(e) => setApplyOffer(e.target.checked)} />
                Dealer offer ({offer.lines.length} lines{offer.grid.length ? `, ${offer.grid.length} grid cells` : ""})
              </label>
              {!offerHasData ? (
                <p className="mt-2 text-sm text-ink-2">No offer figures found on this document.</p>
              ) : (
                <>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <MoneyInput label="Selling price" value={offer.sellingPriceCents} onChange={(c) => setOffer((o) => o && { ...o, sellingPriceCents: c })} />
                    <MoneyInput label="Trade allowance" value={offer.tradeAllowanceCents} onChange={(c) => setOffer((o) => o && { ...o, tradeAllowanceCents: c })} />
                    <MoneyInput label="Stated total" value={offer.statedTotalCents} onChange={(c) => setOffer((o) => o && { ...o, statedTotalCents: c })} />
                    <MoneyInput label="Stated balance" value={offer.statedBalanceCents} onChange={(c) => setOffer((o) => o && { ...o, statedBalanceCents: c })} />
                  </div>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {offer.lines.map((l) => (
                        <tr key={l.id} className="border-t border-line/70">
                          <td className="py-1 pr-2">
                            <input aria-label="Line label" className="field" value={l.label} onChange={(e) => setOffer((o) => o && { ...o, lines: o.lines.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) })} />
                          </td>
                          <td className="py-1 pr-2">
                            <select aria-label="Category" className="field" value={l.category} onChange={(e) => setOffer((o) => o && { ...o, lines: o.lines.map((x) => (x.id === l.id ? { ...x, category: e.target.value as LineCategory } : x)) })}>
                              {(["dealer_fee", "dealer_addon", "gov_fee", "tax", "manufacturer_rebate", "conditional_rebate", "dealer_discount", "other"] as LineCategory[]).map((c) => (
                                <option key={c} value={c}>
                                  {c.replace(/_/g, " ")}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="w-36 py-1">
                            <MoneyInput compact label={`${l.label} amount`} value={l.cents} onChange={(c) => setOffer((o) => o && { ...o, lines: o.lines.map((x) => (x.id === l.id ? { ...x, cents: c } : x)) })} />
                          </td>
                          <td className="py-1 pl-1">
                            <button type="button" className="btn btn-quiet btn-sm" aria-label={`Remove ${l.label}`} onClick={() => setOffer((o) => o && { ...o, lines: o.lines.filter((x) => x.id !== l.id) })}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-sm">
                    Selling price minus trade plus lines: <span className="num">{formatCents(offerSum)}</span>
                    {offer.statedTotalCents !== null && (
                      <>
                        {" "}
                        vs stated total <span className="num">{formatCents(offer.statedTotalCents)}</span>.{" "}
                        {offerReconciles ? <span className="pill pill-good">reconciles</span> : <span className="pill pill-flag">does not reconcile</span>}
                      </>
                    )}
                  </p>
                  {offer.grid.length > 0 && <p className="num mt-1 text-xs text-ink-2">Grid: {offer.grid.map((c) => `${c.termMonths}mo/${formatCents(c.cashDownCents, { cents: false })} down: ${formatCents(c.paymentCents)}`).join("; ")}</p>}
                </>
              )}
            </section>

            {(vehicle.vin || vehicle.year || vehicle.trim) && (
              <section className="card p-4 text-sm">
                <p className="font-medium">Vehicle fields found</p>
                <p className="text-ink-2">
                  {[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")}
                  {vehicle.vin && <span className="num"> · {vehicle.vin}</span>}
                  {vehicle.exteriorColor && ` · ${vehicle.exteriorColor}`}
                </p>
                <p className="mt-1 text-xs text-ink-2">Blank vehicle fields on the deal are filled from these; existing values are kept. Current: {[current.vehicle.year, current.vehicle.make, current.vehicle.model, current.vehicle.trim].filter(Boolean).join(" ") || "none"}.</p>
              </section>
            )}

            <div className="card p-4">
              {blocked && <p className="mb-2 text-sm text-flag">Import is blocked until the selected sections reconcile. Fix the amounts above or uncheck a section.</p>}
              {error && (
                <p className="mb-2 text-sm text-flag" role="alert">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={!canApply || blocked || pending} onClick={apply}>
                  {pending ? "Saving" : "Confirm and save to deal"}
                </button>
                <button type="button" className="btn" onClick={extract} disabled={busy}>
                  {busy ? "Reading" : "Extract again"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
