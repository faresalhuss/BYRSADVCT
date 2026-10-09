"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createDeal, updateDeal } from "@/db/actions";
import type { DealForm } from "@/domain/schemas";
import {
  checkVin,
  daysBetween,
  evaluateDeal,
  formatApr,
  formatCents,
  type DealReport,
  type LineCategory,
  type Offer,
  type OfferLine,
  type Settings,
  type StickerLine,
  type TaxRule,
  type TradeProfile,
  type VehicleDecoded,
} from "@/engine";
import { SeverityPill } from "@/components/pills";
import { Money, Pct } from "@/components/money";
import { clearDraft, loadDraft, saveDraft, type Draft } from "./draft-store";
import { MoneyInput } from "./money-input";

export interface EditorContext {
  taxRule: TaxRule;
  settings: Settings;
  trade: TradeProfile;
  today: string;
}

interface Props {
  mode: "new" | "edit";
  dealId: string | null;
  initial: DealForm;
  previousOffer: Offer | null;
  context: EditorContext;
}

type Sync = "idle" | "dirty" | "saving" | "saved" | "error";

const CATEGORY_LABEL: Record<LineCategory, string> = {
  dealer_fee: "Dealer fee",
  dealer_addon: "Dealer add-on",
  gov_fee: "Government fee",
  tax: "Tax (as stated)",
  manufacturer_rebate: "Manufacturer rebate",
  conditional_rebate: "Conditional rebate",
  dealer_discount: "Dealer discount (info)",
  other: "Other",
};

const QUICK_LINES: { label: string; category: LineCategory; taxable: boolean | null }[] = [
  { label: "Doc fee", category: "dealer_fee", taxable: true },
  { label: "ELT", category: "dealer_fee", taxable: false },
  { label: "State taxes and fees", category: "tax", taxable: null },
  { label: "Title", category: "gov_fee", taxable: false },
  { label: "Registration", category: "gov_fee", taxable: false },
  { label: "Georgia lemon law fee", category: "gov_fee", taxable: false },
  { label: "Add-on", category: "dealer_addon", taxable: true },
  { label: "Manufacturer rebate", category: "manufacturer_rebate", taxable: null },
];

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function DealEditor({ mode, dealId, initial, previousOffer, context }: Props) {
  const router = useRouter();
  const draftKey = dealId ?? "new";
  const [form, setForm] = useState<DealForm>(initial);
  const [sync, setSync] = useState<Sync>("idle");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [pending, startTransition] = useTransition();
  const dirtyRef = useRef(false);

  const report: DealReport = useMemo(
    () =>
      evaluateDeal({
        id: dealId ?? "new",
        name: form.dealershipName || "New deal",
        sticker: form.sticker,
        vehicle: form.vehicle,
        decoded: form.decoded,
        offer: form.offer,
        previousOffer,
        trade: context.trade,
        taxRule: context.taxRule,
        settings: context.settings,
        today: context.today,
      }),
    [form, dealId, previousOffer, context],
  );

  // Drafts survive a lost signal: debounce-save to IndexedDB on every change.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => void saveDraft(draftKey, form), 400);
    return () => clearTimeout(t);
  }, [form, draftKey]);

  useEffect(() => {
    let cancelled = false;
    void loadDraft(draftKey).then((d) => {
      if (!cancelled && d && JSON.stringify(d.form) !== JSON.stringify(initial)) setDraft(d);
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey, initial]);

  const update = useCallback((patch: (f: DealForm) => DealForm) => {
    dirtyRef.current = true;
    setSync("dirty");
    setForm((f) => patch(f));
  }, []);

  const setOffer = useCallback((patch: (o: Offer) => Offer) => update((f) => ({ ...f, offer: patch(f.offer) })), [update]);

  function save() {
    setError(null);
    setIssues({});
    setSync("saving");
    startTransition(async () => {
      const res = mode === "new" ? await createDeal(form) : await updateDeal(dealId!, form);
      if (!res.ok) {
        setSync("error");
        setError(res.error);
        setIssues(res.issues ?? {});
        return;
      }
      await clearDraft(draftKey);
      dirtyRef.current = false;
      setSync("saved");
      router.push(`/deals/${res.data.id}`);
      router.refresh();
    });
  }

  const openFlags = report.flags.filter((f) => f.severity === "flag").length;
  const vinCheck = checkVin(form.vehicle.vin);

  return (
    <div className="pb-8">
      {/* Sticky summary: the three numbers that matter, and Save. */}
      <div className="sticky top-12 z-20 -mx-4 border-b border-line bg-surface-2/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <dl className="flex gap-4 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-ink-2">All-in % SRP</dt>
              <dd className="text-lg leading-tight">
                <Pct value={report.price.allInRatio.value} label="All-in as percent of total SRP" />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-ink-2">OTD</dt>
              <dd className="text-lg leading-tight">
                <Money cents={report.price.otd.value} label="Out the door" showCents={false} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-ink-2">Flags</dt>
              <dd className={`num text-lg leading-tight ${openFlags > 0 ? "text-flag" : ""}`}>{openFlags}</dd>
            </div>
          </dl>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-ink-2 sm:inline" aria-live="polite">
              {!online ? "Offline, draft kept on this device" : sync === "dirty" ? "Unsaved changes" : sync === "saving" ? "Saving" : sync === "saved" ? "Saved" : sync === "error" ? "Not saved" : ""}
            </span>
            <button type="button" className="btn btn-primary" onClick={save} disabled={pending || !online}>
              {pending ? "Saving" : mode === "new" ? "Create deal" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {draft && (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-3" role="status">
          <p className="text-sm">An unsaved draft from {new Date(draft.savedAt).toLocaleString()} is on this device.</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                dirtyRef.current = true;
                setForm(draft.form);
                setSync("dirty");
                setDraft(null);
              }}
            >
              Resume draft
            </button>
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              onClick={() => {
                void clearDraft(draftKey);
                setDraft(null);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-sm bg-flag-bg px-3 py-2 text-flag" role="alert">
          {error}
        </p>
      )}

      {/* Dealership */}
      <Section title="Dealership" open>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Dealership name" value={form.dealershipName} onChange={(v) => update((f) => ({ ...f, dealershipName: v }))} error={issues.dealershipName} required autoFocus={mode === "new"} />
          <Text label="Salesperson" value={form.salesperson ?? ""} onChange={(v) => update((f) => ({ ...f, salesperson: v || null }))} />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Status</span>
            <select className="field" value={form.status} onChange={(e) => update((f) => ({ ...f, status: e.target.value as DealForm["status"] }))}>
              <option value="verbal">Verbal</option>
              <option value="written">Written</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <Text label="Quote expires" type="date" value={form.quoteExpiresOn ?? ""} onChange={(v) => update((f) => ({ ...f, quoteExpiresOn: v || null, offer: { ...f.offer, quoteExpiresOn: v || null } }))} />
          <Text label="Address" value={form.dealershipAddress ?? ""} onChange={(v) => update((f) => ({ ...f, dealershipAddress: v || null }))} />
          <Text label="Phone" type="tel" value={form.dealershipPhone ?? ""} onChange={(v) => update((f) => ({ ...f, dealershipPhone: v || null }))} />
          <Text label="Website" type="url" value={form.dealershipWebsite ?? ""} onChange={(v) => update((f) => ({ ...f, dealershipWebsite: v || null }))} />
        </div>
      </Section>

      {/* Vehicle */}
      <Section title="Vehicle" open>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <VinField
              value={form.vehicle.vin ?? ""}
              check={vinCheck}
              decoded={form.decoded}
              onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, vin: v || null }, decoded: v.trim().toUpperCase() === (f.vehicle.vin ?? "").trim().toUpperCase() ? f.decoded : null }))}
              onDecoded={(d) => update((f) => ({ ...f, decoded: d }))}
              onUse={(field, value) => update((f) => ({ ...f, vehicle: { ...f.vehicle, [field]: value } }))}
              entered={form.vehicle}
            />
          </div>
          <Text label="Year" type="number" value={form.vehicle.year?.toString() ?? ""} onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, year: v ? Number(v) : null } }))} />
          <Text label="Make" value={form.vehicle.make ?? ""} onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, make: v || null } }))} />
          <Text label="Model" value={form.vehicle.model ?? ""} onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, model: v || null } }))} />
          <Text label="Trim" value={form.vehicle.trim ?? ""} onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, trim: v || null } }))} />
          <Text label="Powertrain" value={form.vehicle.powertrain ?? ""} onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, powertrain: v || null } }))} hint="For example: i-FORCE 2.4L turbo gas, or i-FORCE MAX hybrid" />
          <Text label="Exterior color" value={form.vehicle.exteriorColor ?? ""} onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, exteriorColor: v || null } }))} />
          <Text label="Interior color" value={form.vehicle.interiorColor ?? ""} onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, interiorColor: v || null } }))} />
          <Text label="Stock number" value={form.vehicle.stockNumber ?? ""} onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, stockNumber: v || null } }))} />
          <Text
            label="Stock date"
            type="date"
            value={form.vehicle.stockDate ?? ""}
            onChange={(v) => update((f) => ({ ...f, vehicle: { ...f.vehicle, stockDate: v || null } }))}
            hint={form.vehicle.stockDate ? `${daysBetween(form.vehicle.stockDate, context.today)} days on lot` : undefined}
          />
        </div>
      </Section>

      {/* Sticker */}
      <Section title="Window sticker" open>
        <p className="mb-3 text-sm text-ink-2">Enter each printed line. The bottom line is Total SRP; the lines must add up to it.</p>
        <LineTable>
          {form.sticker.lines.map((line) => (
            <tr key={line.id}>
              <td className="py-1 pr-2">
                <input aria-label="Line label" className="field" value={line.label} onChange={(e) => updateStickerLine(update, line.id, { label: e.target.value })} />
              </td>
              <td className="py-1 pr-2">
                <select aria-label="Sticker group" className="field" value={line.group} onChange={(e) => updateStickerLine(update, line.id, { group: e.target.value as StickerLine["group"] })}>
                  <option value="base">Base MSRP</option>
                  <option value="factory_option">Factory option</option>
                  <option value="distributor_option">Distributor or port option</option>
                  <option value="dph">DPH</option>
                </select>
              </td>
              <td className="w-36 py-1 pr-2">
                <MoneyInput compact label={`${line.label} amount`} value={line.cents} onChange={(c) => updateStickerLine(update, line.id, { cents: c })} />
              </td>
              <td className="py-1">
                <button type="button" className="btn btn-quiet btn-sm" aria-label={`Remove ${line.label}`} onClick={() => update((f) => ({ ...f, sticker: { ...f.sticker, lines: f.sticker.lines.filter((l) => l.id !== line.id) } }))}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </LineTable>
        <div className="mt-2 flex flex-wrap gap-2">
          {form.sticker.lines.length === 0 && (
            <button type="button" className="btn btn-sm" onClick={() => update((f) => ({ ...f, sticker: { ...f.sticker, lines: defaultStickerLines() } }))}>
              Start with base MSRP, DPH and option rows
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={() => update((f) => ({ ...f, sticker: { ...f.sticker, lines: [...f.sticker.lines, { id: uid("sl"), label: "Option", cents: null, group: "factory_option", source: "sticker" }] } }))}>
            Add line
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MoneyInput label="Total SRP (bottom line)" value={form.sticker.totalSrpCents} onChange={(c) => update((f) => ({ ...f, sticker: { ...f.sticker, totalSrpCents: c } }))} />
          <div className="self-end text-sm">
            {report.sticker.reconciles === true && <span className="pill pill-good">Reconciles</span>}
            {report.sticker.reconciles === false && (
              <span className="pill pill-flag">
                Off by {formatCents(report.sticker.discrepancy.value)}
              </span>
            )}
            {report.sticker.reconciles === null && <span className="pill pill-info">Waiting for amounts</span>}
            <p className="mt-1 text-ink-2">
              Lines sum to <Money cents={report.sticker.lineSum.value} />. Factory MSRP + DPH: <Money cents={report.sticker.factoryMsrpPlusDph.value} />.
            </p>
          </div>
        </div>
      </Section>

      {/* Offer */}
      <Section title="Dealer offer" open>
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyInput label="Selling price" value={form.offer.sellingPriceCents} onChange={(c) => setOffer((o) => ({ ...o, sellingPriceCents: c }))} hint="Dealer's price for the vehicle before fees, tax and title." />
          <MoneyInput label="Stated discount (if printed)" value={form.offer.statedDiscountCents ?? null} onChange={(c) => setOffer((o) => ({ ...o, statedDiscountCents: c }))} />
          <MoneyInput label="Trade allowance" value={form.offer.tradeAllowanceCents} onChange={(c) => setOffer((o) => ({ ...o, tradeAllowanceCents: c }))} hint="Leave empty for a no-trade quote." />
          <MoneyInput label="Cash down" value={form.offer.cashDownCents} onChange={(c) => setOffer((o) => ({ ...o, cashDownCents: c }))} />
          <MoneyInput label="Dealer's stated total" value={form.offer.statedTotalCents ?? null} onChange={(c) => setOffer((o) => ({ ...o, statedTotalCents: c }))} hint="The worksheet's total line, for the audit only." />
          <MoneyInput label="Dealer's stated balance" value={form.offer.statedBalanceCents ?? null} onChange={(c) => setOffer((o) => ({ ...o, statedBalanceCents: c }))} hint="Usually total + payoff - cash down. The payment grid is checked against it." />
        </div>

        <h3 className="mt-6 text-sm font-medium">Fees, add-ons, tax and rebates</h3>
        <p className="mb-2 text-xs text-ink-2">One line per item on the worksheet. Classify each; you can override whether it is taxed.</p>
        <LineTable>
          {form.offer.lines.map((line) => (
            <tr key={line.id}>
              <td className="py-1 pr-2">
                <input aria-label="Line label" className="field" value={line.label} onChange={(e) => updateOfferLine(setOffer, line.id, { label: e.target.value })} />
              </td>
              <td className="py-1 pr-2">
                <select aria-label="Category" className="field" value={line.category} onChange={(e) => updateOfferLine(setOffer, line.id, { category: e.target.value as LineCategory })}>
                  {(Object.keys(CATEGORY_LABEL) as LineCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="w-36 py-1 pr-2">
                <MoneyInput compact label={`${line.label} amount`} value={line.cents} onChange={(c) => updateOfferLine(setOffer, line.id, { cents: c })} />
              </td>
              <td className="py-1 pr-2">
                {line.category === "manufacturer_rebate" || line.category === "conditional_rebate" ? (
                  <select aria-label="Where the rebate is applied" className="field" value={line.applied ?? ""} onChange={(e) => updateOfferLine(setOffer, line.id, { applied: (e.target.value || null) as OfferLine["applied"] })}>
                    <option value="">Applied where?</option>
                    <option value="after_price">After selling price</option>
                    <option value="in_price">Folded into price</option>
                  </select>
                ) : line.category === "tax" || line.category === "dealer_discount" ? (
                  <span className="text-xs text-ink-2">n/a</span>
                ) : (
                  <select aria-label="Taxable" className="field" value={line.taxable === null ? "" : line.taxable ? "yes" : "no"} onChange={(e) => updateOfferLine(setOffer, line.id, { taxable: e.target.value === "" ? null : e.target.value === "yes" })}>
                    <option value="">Taxable: rule default ({context.taxRule.taxableByCategory[line.category] ? "yes" : "no"})</option>
                    <option value="yes">Taxable: yes</option>
                    <option value="no">Taxable: no</option>
                  </select>
                )}
              </td>
              <td className="py-1">
                <button type="button" className="btn btn-quiet btn-sm" aria-label={`Remove ${line.label}`} onClick={() => setOffer((o) => ({ ...o, lines: o.lines.filter((l) => l.id !== line.id) }))}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </LineTable>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_LINES.map((q) => (
            <button key={q.label} type="button" className="btn btn-sm" onClick={() => setOffer((o) => ({ ...o, lines: [...o.lines, { id: uid("ol"), label: q.label, cents: null, category: q.category, taxable: q.taxable, source: "worksheet", applied: q.category === "manufacturer_rebate" ? null : undefined }] }))}>
              + {q.label}
            </button>
          ))}
        </div>
        {form.offer.lines.some((l) => l.category === "conditional_rebate") && (
          <div className="mt-3 grid gap-2">
            {form.offer.lines
              .filter((l) => l.category === "conditional_rebate")
              .map((l) => (
                <Text key={l.id} label={`Condition for ${l.label}`} value={l.condition ?? ""} onChange={(v) => updateOfferLine(setOffer, l.id, { condition: v || null })} hint="For example: finance through TFS, college grad, military." />
              ))}
          </div>
        )}
      </Section>

      {/* Financing */}
      <Section title="Financing and payment grid">
        <h3 className="text-sm font-medium">Financing quotes</h3>
        {form.offer.financing.map((q) => (
          <div key={q.id} className="mt-2 grid gap-2 rounded-md border border-line p-3 sm:grid-cols-3">
            <Text label="Lender" value={q.lender ?? ""} onChange={(v) => updateQuote(setOffer, q.id, { lender: v || null })} />
            <PercentInput label="APR" value={q.apr} onChange={(v) => updateQuote(setOffer, q.id, { apr: v })} />
            <Text label="Term (months)" type="number" value={q.termMonths?.toString() ?? ""} onChange={(v) => updateQuote(setOffer, q.id, { termMonths: v ? Number(v) : null })} />
            <MoneyInput label="Cash down" value={q.cashDownCents} onChange={(c) => updateQuote(setOffer, q.id, { cashDownCents: c })} />
            <MoneyInput label="Amount financed" value={q.amountFinancedCents} onChange={(c) => updateQuote(setOffer, q.id, { amountFinancedCents: c })} hint="Leave empty to use stated balance minus cash down." />
            <MoneyInput label="Quoted payment" value={q.paymentCents} onChange={(c) => updateQuote(setOffer, q.id, { paymentCents: c })} />
            <div className="sm:col-span-3">
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOffer((o) => ({ ...o, financing: o.financing.filter((x) => x.id !== q.id) }))}>
                Remove quote
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-sm mt-2" onClick={() => setOffer((o) => ({ ...o, financing: [...o.financing, { id: uid("fq"), lender: null, apr: null, termMonths: null, cashDownCents: null, amountFinancedCents: null, paymentCents: null, source: "worksheet" }] }))}>
          Add financing quote
        </button>

        <h3 className="mt-6 text-sm font-medium">Payment grid</h3>
        <p className="mb-2 text-xs text-ink-2">Enter the worksheet grid as printed: one row per term, one column per cash-down amount. Every cell is checked for its implied APR.</p>
        <PaymentGridEditor offer={form.offer} setOffer={setOffer} />
        <div className="mt-3 max-w-sm">
          <MoneyInput label="Grid principal (if different from stated balance)" value={form.offer.gridPrincipalCents ?? null} onChange={(c) => setOffer((o) => ({ ...o, gridPrincipalCents: c }))} />
        </div>
        {report.financing.grid.length > 0 && (
          <ul className="mt-3 text-sm">
            {report.financing.grid.map((row) => (
              <li key={row.termMonths} className="num">
                {row.termMonths} months: implied APR {formatApr(row.impliedApr, 2)}
                {row.consistent === false && <span className="ml-2 pill pill-caution">cells disagree</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Revision note */}
      {mode === "edit" && (
        <Section title="Revision note" open>
          <Text label="What changed in this revision (optional)" value={form.revisionNote ?? ""} onChange={(v) => update((f) => ({ ...f, revisionNote: v || null }))} />
        </Section>
      )}

      {/* Live flags */}
      <Section title={`Flags (${report.flags.length})`} open>
        {report.flags.length === 0 ? (
          <p className="text-sm text-ink-2">Nothing flagged so far.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.flags.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-sm">
                <SeverityPill severity={f.severity} />
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-ink-2">{f.detail}</p>
                  {f.impactCents !== null && (
                    <p className="num text-ink-2">
                      Impact: <Money cents={f.impactCents} />
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="mt-6 flex justify-end">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending || !online}>
          {pending ? "Saving" : mode === "new" ? "Create deal" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function defaultStickerLines(): StickerLine[] {
  return [
    { id: uid("sl"), label: "Base MSRP", cents: null, group: "base", source: "sticker" },
    { id: uid("sl"), label: "Factory option", cents: null, group: "factory_option", source: "sticker" },
    { id: uid("sl"), label: "Distributor option", cents: null, group: "distributor_option", source: "sticker" },
    { id: uid("sl"), label: "Delivery, processing and handling", cents: null, group: "dph", source: "sticker" },
  ];
}

function updateStickerLine(update: (p: (f: DealForm) => DealForm) => void, id: string, patch: Partial<StickerLine>) {
  update((f) => ({ ...f, sticker: { ...f.sticker, lines: f.sticker.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } }));
}

function updateOfferLine(setOffer: (p: (o: Offer) => Offer) => void, id: string, patch: Partial<OfferLine>) {
  setOffer((o) => ({ ...o, lines: o.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
}

function updateQuote(setOffer: (p: (o: Offer) => Offer) => void, id: string, patch: Partial<Offer["financing"][number]>) {
  setOffer((o) => ({ ...o, financing: o.financing.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
}

function Section({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="card mt-4 p-4">
      <summary className="tap -m-1 flex cursor-pointer list-none items-center justify-between rounded-sm p-1 text-lg font-medium">
        <span className="serif">{title}</span>
        <span aria-hidden="true" className="text-ink-2">
          +
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function LineTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[640px] text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Text({ label, value, onChange, type = "text", hint, error, required, autoFocus }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; error?: string; required?: boolean; autoFocus?: boolean }) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input id={id} type={type} className="field" value={value} required={required} autoFocus={autoFocus} aria-invalid={error ? "true" : undefined} aria-describedby={hint || error ? `${id}-desc` : undefined} onChange={(e) => onChange(e.target.value)} />
      {(hint || error) && (
        <p id={`${id}-desc`} className={`text-xs ${error ? "text-flag" : "text-ink-2"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

function PercentInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : (value * 100).toString());
  const id = `p-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className="field num pr-8 text-right"
          value={text}
          placeholder="4.99"
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const n = Number(t.replace(/[%\s,]/g, ""));
            onChange(t.trim() === "" || !Number.isFinite(n) ? null : n / 100);
          }}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-2">
          %
        </span>
      </div>
    </div>
  );
}

function VinField({ value, check, decoded, entered, onChange, onDecoded, onUse }: { value: string; check: ReturnType<typeof checkVin>; decoded: VehicleDecoded | null; entered: DealForm["vehicle"]; onChange: (v: string) => void; onDecoded: (d: VehicleDecoded | null) => void; onUse: (field: "year" | "make" | "model" | "trim" | "powertrain", value: string | number | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function decode() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/vin/${encodeURIComponent(value.trim())}`);
      const json = (await res.json()) as { decoded?: VehicleDecoded; error?: string };
      if (!res.ok || !json.decoded) throw new Error(json.error ?? "Decode failed");
      onDecoded(json.decoded);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Decode failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label htmlFor="vin" className="text-sm font-medium">
        VIN
      </label>
      <div className="mt-1 flex gap-2">
        <input id="vin" className="field num uppercase" value={value} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={17} aria-describedby="vin-status" onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn" onClick={decode} disabled={busy || !check || check.vin.length !== 17}>
          {busy ? "Decoding" : "Decode"}
        </button>
      </div>
      <p id="vin-status" className={`mt-1 text-xs ${check && !check.valid ? "text-flag" : "text-ink-2"}`}>
        {!check ? "17 characters; the check digit is verified as you type." : check.valid ? `Check digit ${check.checkDigit} is valid.` : check.reason}
        {err && <span className="ml-2 text-flag">{err}</span>}
      </p>
      {decoded && (
        <div className="mt-2 rounded-md border border-line bg-surface-2/50 p-3 text-sm">
          <p className="mb-2 font-medium">NHTSA decode beside what you entered</p>
          {decoded.errorCode && <p className="mb-2 text-caution">{decoded.errorCode}</p>}
          <table className="w-full">
            <thead className="text-xs uppercase text-ink-2">
              <tr>
                <th className="text-left font-medium">Field</th>
                <th className="text-left font-medium">Entered</th>
                <th className="text-left font-medium">Decoded</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["year", "Year", entered.year, decoded.modelYear],
                  ["make", "Make", entered.make, decoded.make],
                  ["model", "Model", entered.model, decoded.model],
                  ["trim", "Trim", entered.trim, decoded.trim],
                  ["powertrain", "Powertrain", entered.powertrain, [decoded.fuelType, decoded.engine].filter(Boolean).join(", ") || null],
                ] as const
              ).map(([field, label, a, b]) => (
                <tr key={field} className="border-t border-line">
                  <td className="py-1 pr-2 text-ink-2">{label}</td>
                  <td className="py-1 pr-2">{a ?? "—"}</td>
                  <td className="py-1 pr-2">{b ?? "—"}</td>
                  <td className="py-1 text-right">
                    {b !== null && b !== undefined && String(a ?? "") !== String(b) && (
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => onUse(field, b as string | number)}>
                        Use
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-1 pr-2 text-ink-2">Drive</td>
                <td className="py-1 pr-2" />
                <td className="py-1 pr-2" colSpan={2}>
                  {decoded.driveType ?? "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentGridEditor({ offer, setOffer }: { offer: Offer; setOffer: (p: (o: Offer) => Offer) => void }) {
  const terms = useMemo(() => [...new Set(offer.paymentGrid.map((c) => c.termMonths))].sort((a, b) => a - b), [offer.paymentGrid]);
  const downs = useMemo(() => [...new Set(offer.paymentGrid.map((c) => c.cashDownCents))].sort((a, b) => a - b), [offer.paymentGrid]);
  const [newTerm, setNewTerm] = useState("");
  const [newDown, setNewDown] = useState<number | null>(null);
  const [extraTerms, setExtraTerms] = useState<number[]>([]);
  const [extraDowns, setExtraDowns] = useState<number[]>([]);
  const allTerms = [...new Set([...terms, ...extraTerms])].sort((a, b) => a - b);
  const allDowns = [...new Set([...downs, ...extraDowns])].sort((a, b) => a - b);

  const cell = (t: number, d: number) => offer.paymentGrid.find((c) => c.termMonths === t && c.cashDownCents === d) ?? null;
  const setCell = (t: number, d: number, payment: number | null) =>
    setOffer((o) => {
      const rest = o.paymentGrid.filter((c) => !(c.termMonths === t && c.cashDownCents === d));
      return { ...o, paymentGrid: payment === null ? rest : [...rest, { id: `g-${t}-${d}`, termMonths: t, cashDownCents: d, paymentCents: payment, source: "worksheet" }] };
    });

  return (
    <div>
      {allTerms.length > 0 && allDowns.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="min-w-[420px] text-sm">
            <thead>
              <tr>
                <th className="pr-2 text-left text-xs uppercase text-ink-2">Term</th>
                {allDowns.map((d) => (
                  <th key={d} className="num px-1 text-right text-xs uppercase text-ink-2">
                    {formatCents(d, { cents: false })} down
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTerms.map((t) => (
                <tr key={t}>
                  <th scope="row" className="num pr-2 text-left font-medium">
                    {t} mo
                  </th>
                  {allDowns.map((d) => (
                    <td key={d} className="w-32 px-1 py-1">
                      <MoneyInput compact label={`Payment at ${t} months with ${formatCents(d, { cents: false })} down`} value={cell(t, d)?.paymentCents ?? null} onChange={(c) => setCell(t, d, c)} placeholder="" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="grid-term" className="text-xs text-ink-2">
            Add term (months)
          </label>
          <div className="flex gap-1">
            <input id="grid-term" type="number" inputMode="numeric" className="field w-28" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                const t = Number(newTerm);
                if (t > 0) setExtraTerms((x) => [...x, t]);
                setNewTerm("");
              }}
            >
              Add
            </button>
          </div>
        </div>
        <div className="flex items-end gap-1">
          <div className="w-40">
            <MoneyInput label="Add cash-down column" value={newDown} onChange={setNewDown} placeholder="0" />
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setExtraDowns((x) => [...x, newDown ?? 0]);
              setNewDown(null);
            }}
          >
            Add
          </button>
        </div>
        {allTerms.length === 0 && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setExtraTerms([48, 60, 72]);
              setExtraDowns([0, 250000, 500000]);
            }}
          >
            Start with 48/60/72 and $0/$2,500/$5,000
          </button>
        )}
      </div>
    </div>
  );
}
