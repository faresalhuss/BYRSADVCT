"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createDeal, updateDeal } from "@/db/actions";
import type { DealForm } from "@/domain/schemas";
import {
  checkVin,
  daysBetween,
  evaluateDeal,
  formatApr,
  formatCents,
  type DealReport,
  type LeaseTerms,
  type LineCategory,
  roundHalfUp,
  type Source,
  type Offer,
  type OfferLine,
  type Settings,
  type StickerLine,
  type TaxRule,
  type TradeProfile,
} from "@/engine";
import { SeverityPill } from "@/components/pills";
import { Term } from "@/components/term";
import { Explain } from "@/components/ui";
import { Icon } from "@/components/icons";
import { VerdictPill } from "@/components/pills";
import { VinField } from "./vin-field";
import { formatPhoneInput } from "@/lib/phone";
import { ImportPanel, type ImportedFile } from "./import-panel";
import type { Extraction } from "@/lib/anthropic";
import { Money } from "@/components/money";
import { clearDraft, loadDraft, saveDraft, type Draft } from "./draft-store";
import { LineList, LineRow } from "./line-row";
import { MoneyInput } from "./money-input";
import { SummaryBar } from "@/components/summary-bar";

export interface EditorContext {
  taxRule: TaxRule;
  settings: Settings;
  trade: TradeProfile;
  today: string;
  /** Whether the server has an Anthropic key (import panel enabled). */
  importEnabled: boolean;
  /** Open the import panel first (from "Import from documents"). */
  openImport: boolean;
}

const EMPTY_LEASE: LeaseTerms = {
  termMonths: 36,
  milesPerYear: 12000,
  agreedValueCents: null,
  capitalizedFeesCents: null,
  acquisitionFeeCents: null,
  acquisitionFeeCapitalized: true,
  capReductionCashCents: null,
  capReductionRebatesCents: null,
  capReductionTradeCents: null,
  residualPercent: null,
  residualCents: null,
  moneyFactor: null,
  quotedPaymentCents: null,
  quotedPaymentIncludesTax: false,
  dueAtSigningCents: null,
  firstPaymentAtSigning: true,
  taxIncludedInDueAtSigning: true,
  statedTaxCents: null,
  dispositionFeeCents: null,
  lender: "Southeast Toyota Finance",
};

const toCents = (d: number | null | undefined): number | null => (d === null || d === undefined ? null : roundHalfUp(d * 100));

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
  const [importFiles, setImportFiles] = useState<ImportedFile[]>(initial.importFiles ?? []);
  const [batchId] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())));
  const dealType: "purchase" | "lease" = form.offer.dealType === "lease" ? "lease" : "purchase";

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
      const res = mode === "new" ? await createDeal({ ...form, importFiles }) : await updateDeal(dealId!, form);
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
      {/* Sticky summary: the three numbers that matter, the sync state, and Save. */}
      <SummaryBar allInRatio={report.price.allInRatio.value} otdCents={report.price.otd.value} openFlags={openFlags}>
        <div className="flex flex-col items-end gap-1">
          <button type="button" className="btn btn-primary" onClick={save} disabled={pending || !online}>
            {pending ? "Saving" : mode === "new" ? "Create deal" : "Save"}
          </button>
          <span className="max-w-40 truncate text-xs text-ink-2" role="status" aria-live="polite">
            {!online ? "Offline: draft kept on this device" : sync === "dirty" ? "Unsaved changes" : sync === "saving" ? "Saving" : sync === "saved" ? "Saved" : sync === "error" ? "Not saved" : "\u00a0"}
          </span>
        </div>
      </SummaryBar>

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

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
      <div className="min-w-0">
      {mode === "new" && (
        <div className="mt-4">
          <ImportPanel enabled={context.importEnabled} batchId={batchId} files={importFiles} onFiles={setImportFiles} onExtracted={(x) => applyExtraction(x, update)} />
        </div>
      )}

      {/* Dealership */}
      <Section title="Dealership" open intro="Who quoted this, and when it expires. Tap the address later to open it in Google Maps.">
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
          <Text label="Phone" type="tel" value={form.dealershipPhone ?? ""} onChange={(v) => update((f) => ({ ...f, dealershipPhone: formatPhoneInput(v) || null }))} hint="Formatted as you type; tap it on the deal page to call." />
          <Text label="Website" type="url" value={form.dealershipWebsite ?? ""} onChange={(v) => update((f) => ({ ...f, dealershipWebsite: v || null }))} />
        </div>
      </Section>

      {/* Vehicle */}
      <Section title="Vehicle" open intro="VIN first: the check digit is verified as you type and NHTSA decodes it beside what you entered.">
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
      <Section title="Window sticker" open intro="Total SRP is the bottom line. The lines must add up to it; distributor options are negotiable even though they are printed.">
        <p className="mb-3 text-sm text-ink-2">Enter each printed line. The bottom line is Total SRP; the lines must add up to it.</p>
        <LineList empty="No sticker lines yet.">
          {form.sticker.lines.map((line) => (
            <LineRow
              key={line.id}
              removeLabel={`Remove ${line.label}`}
              onRemove={() => update((f) => ({ ...f, sticker: { ...f.sticker, lines: f.sticker.lines.filter((l) => l.id !== line.id) } }))}
              note={
                <>
                  <input aria-label={`Note for ${line.label}`} className="field" placeholder="Note (optional)" value={line.note ?? ""} onChange={(e) => updateStickerLine(update, line.id, { note: e.target.value || undefined })} />
                  <SourceSelect label={`Source of ${line.label}`} value={line.source} onChange={(v) => updateStickerLine(update, line.id, { source: v })} />
                </>
              }
            >
              <input aria-label="Line label" className="field" value={line.label} onChange={(e) => updateStickerLine(update, line.id, { label: e.target.value })} />
              <select aria-label="Sticker group" className="field" value={line.group} onChange={(e) => updateStickerLine(update, line.id, { group: e.target.value as StickerLine["group"] })}>
                <option value="base">Base MSRP</option>
                <option value="factory_option">Factory option</option>
                <option value="distributor_option">Distributor or port option</option>
                <option value="dph">DPH</option>
              </select>
              <MoneyInput compact label={`${line.label} amount`} value={line.cents} onChange={(c) => updateStickerLine(update, line.id, { cents: c })} />
              <span className="hidden sm:block" aria-hidden="true" />
            </LineRow>
          ))}
        </LineList>
        <div className="mt-2 flex flex-wrap gap-2">
          {form.sticker.lines.length === 0 && (
            <button type="button" className="btn btn-sm" onClick={() => update((f) => ({ ...f, sticker: { ...f.sticker, lines: defaultStickerLines() } }))}>
              Start with base MSRP, DPH and option rows
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={() => update((f) => ({ ...f, sticker: { ...f.sticker, lines: [...f.sticker.lines, { id: uid("sl"), label: "Option", cents: null, group: "factory_option", source: "typed" }] } }))}>
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
      <Section title={dealType === "lease" ? "Dealer offer (lease)" : "Dealer offer"} open intro="Price first. The selling price and every fee and add-on decide the deal; trade and financing come after.">
        <div className="mb-4 flex gap-1 rounded-md border border-line bg-surface p-1" role="group" aria-label="Deal type">
          {(["purchase", "lease"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={dealType === t} className={`tap flex-1 rounded-sm px-3 text-sm font-medium ${dealType === t ? "bg-surface-3 text-ink" : "text-ink-2 hover:text-ink"}`} onClick={() => setOffer((o) => ({ ...o, dealType: t, lease: t === "lease" ? (o.lease ?? EMPTY_LEASE) : o.lease ?? null }))}>
              {t === "purchase" ? "Purchase" : "Lease"}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyInput label="Selling price" value={form.offer.sellingPriceCents} onChange={(c) => setOffer((o) => ({ ...o, sellingPriceCents: c }))} hint="Dealer's price for the vehicle before fees, tax and title." />
          <MoneyInput label="Stated discount (if printed)" value={form.offer.statedDiscountCents ?? null} onChange={(c) => setOffer((o) => ({ ...o, statedDiscountCents: c }))} />
          <MoneyInput label="Trade allowance" value={form.offer.tradeAllowanceCents} onChange={(c) => setOffer((o) => ({ ...o, tradeAllowanceCents: c }))} hint="Leave empty for a no-trade quote." />
          <MoneyInput label="Cash down" value={form.offer.cashDownCents} onChange={(c) => setOffer((o) => ({ ...o, cashDownCents: c }))} />
          <MoneyInput label="Dealer's stated total" value={form.offer.statedTotalCents ?? null} onChange={(c) => setOffer((o) => ({ ...o, statedTotalCents: c }))} hint="The worksheet's total line, for the audit only." />
          <MoneyInput label="Dealer's stated balance" value={form.offer.statedBalanceCents ?? null} onChange={(c) => setOffer((o) => ({ ...o, statedBalanceCents: c }))} hint="Usually total + payoff - cash down. The payment grid is checked against it." />
        </div>

        {dealType === "lease" && form.offer.lease && (
          <div className="mt-6 rounded-md border border-line p-3">
            <h3 className="text-sm font-medium">Lease terms</h3>
            <Explain>
              The <Term k="cap_cost">agreed value</Term> is the lease&apos;s selling price. The <Term k="money_factor">money factor</Term> is the interest rate (times 2400 for APR). The <Term k="residual">residual</Term> is set by the lessor. Enter what the worksheet shows; the app solves what the payment implies.
            </Explain>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MoneyInput label="Agreed value (cap cost)" value={form.offer.lease.agreedValueCents} onChange={(c) => setLease(setOffer, { agreedValueCents: c })} hint="Leave the selling price above blank if the dealer only quoted the lease." />
              <Text label="Term (months)" type="number" value={form.offer.lease.termMonths?.toString() ?? ""} onChange={(v) => setLease(setOffer, { termMonths: v ? Number(v) : null })} />
              <Text label="Miles per year" type="number" value={form.offer.lease.milesPerYear?.toString() ?? ""} onChange={(v) => setLease(setOffer, { milesPerYear: v ? Number(v) : null })} />
              <MoneyFactorInput value={form.offer.lease.moneyFactor} onChange={(v) => setLease(setOffer, { moneyFactor: v })} />
              <PercentInput label="Residual (% of total SRP)" value={form.offer.lease.residualPercent} onChange={(v) => setLease(setOffer, { residualPercent: v })} />
              <MoneyInput label="Residual (dollars, if printed)" value={form.offer.lease.residualCents} onChange={(c) => setLease(setOffer, { residualCents: c })} hint="Overrides the percentage when both are present." />
              <MoneyInput label="Cash cap reduction (money down)" value={form.offer.lease.capReductionCashCents} onChange={(c) => setLease(setOffer, { capReductionCashCents: c })} />
              <MoneyInput label="Rebates applied as cap reduction" value={form.offer.lease.capReductionRebatesCents} onChange={(c) => setLease(setOffer, { capReductionRebatesCents: c })} />
              <MoneyInput label="Trade equity applied" value={form.offer.lease.capReductionTradeCents} onChange={(c) => setLease(setOffer, { capReductionTradeCents: c })} />
              <MoneyInput label="Capitalized fees (doc, add-ons rolled in)" value={form.offer.lease.capitalizedFeesCents} onChange={(c) => setLease(setOffer, { capitalizedFeesCents: c })} />
              <MoneyInput label="Acquisition fee" value={form.offer.lease.acquisitionFeeCents} onChange={(c) => setLease(setOffer, { acquisitionFeeCents: c })} hint="SETF standard is $695." />
              <label className="tap flex items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={form.offer.lease.acquisitionFeeCapitalized} onChange={(e) => setLease(setOffer, { acquisitionFeeCapitalized: e.target.checked })} />
                Acquisition fee rolled into the lease
              </label>
              <MoneyInput label="Quoted monthly payment" value={form.offer.lease.quotedPaymentCents} onChange={(c) => setLease(setOffer, { quotedPaymentCents: c })} />
              <MoneyInput label="Due at signing" value={form.offer.lease.dueAtSigningCents} onChange={(c) => setLease(setOffer, { dueAtSigningCents: c })} />
              <MoneyInput label="Lease tax (TAVT) if stated" value={form.offer.lease.statedTaxCents} onChange={(c) => setLease(setOffer, { statedTaxCents: c })} hint="Georgia taxes depreciation plus cash down, paid at signing or capitalized." />
              <MoneyInput label="Disposition fee" value={form.offer.lease.dispositionFeeCents} onChange={(c) => setLease(setOffer, { dispositionFeeCents: c })} hint="SETF standard is $350." />
              <label className="tap flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.offer.lease.firstPaymentAtSigning} onChange={(e) => setLease(setOffer, { firstPaymentAtSigning: e.target.checked })} />
                First payment is part of due at signing
              </label>
              <label className="tap flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.offer.lease.taxIncludedInDueAtSigning} onChange={(e) => setLease(setOffer, { taxIncludedInDueAtSigning: e.target.checked })} />
                Tax is included in due at signing (or capitalized)
              </label>
            </div>
            {report.lease.present && (
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div className="metric">
                  <span className="eyebrow">Computed base payment</span>
                  <span className="metric-value num text-xl">{formatCents(report.lease.basePayment.value)}</span>
                </div>
                <div className="metric">
                  <span className="eyebrow">Effective APR</span>
                  <span className="metric-value num text-xl">{formatApr(report.lease.effectiveApr.value)}</span>
                </div>
                <div className="metric">
                  <span className="eyebrow">APR implied by the quote</span>
                  <span className="metric-value num text-xl">{formatApr(report.lease.impliedApr.value)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {eligiblePrograms(context.settings, dealType).length > 0 && (
          <div className="mt-6 rounded-md border border-line p-3">
            <h3 className="text-sm font-medium">Rebate programs you qualify for</h3>
            <p className="mt-1 text-xs text-ink-2">Tick the ones this dealer has agreed to apply. Each is deducted after the selling price and reduces Georgia TAVT.</p>
            <ul className="mt-2 flex flex-col gap-2">
              {eligiblePrograms(context.settings, dealType).map((p) => {
                const on = (form.offer.appliedPrograms ?? []).includes(p.id);
                return (
                  <li key={p.id}>
                    <label className="tap flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={on} onChange={(e) => setOffer((o) => ({ ...o, appliedPrograms: e.target.checked ? [...(o.appliedPrograms ?? []), p.id] : (o.appliedPrograms ?? []).filter((x) => x !== p.id) }))} />
                      <span>
                        <span className="font-medium">{p.label}</span> <span className="num">{formatCents(p.amountCents, { cents: false })}</span>
                        <span className="block text-xs text-ink-3">{p.requiresTfsFinancing ? "Requires SETF financing. " : ""}{p.stacksWithSpecialApr ? "Stacks with special APR." : "Not with special APR."}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <h3 className="mt-6 text-sm font-medium">Fees, add-ons, tax and rebates</h3>
        <p className="mb-2 text-xs text-ink-2">One line per item on the worksheet. Classify each; you can override whether it is taxed.</p>
        <LineList empty="No lines yet. Add each fee, add-on, tax and rebate from the worksheet.">
          {form.offer.lines.map((line) => (
            <LineRow
              key={line.id}
              removeLabel={`Remove ${line.label}`}
              onRemove={() => setOffer((o) => ({ ...o, lines: o.lines.filter((l) => l.id !== line.id) }))}
              note={
                <>
                  <input aria-label={`Note for ${line.label}`} className="field" placeholder="Note (optional)" value={line.note ?? ""} onChange={(e) => updateOfferLine(setOffer, line.id, { note: e.target.value || undefined })} />
                  <SourceSelect label={`Source of ${line.label}`} value={line.source} onChange={(v) => updateOfferLine(setOffer, line.id, { source: v })} />
                </>
              }
            >
              <input aria-label="Line label" className="field" value={line.label} onChange={(e) => updateOfferLine(setOffer, line.id, { label: e.target.value })} />
              <select aria-label="Category" className="field" value={line.category} onChange={(e) => updateOfferLine(setOffer, line.id, { category: e.target.value as LineCategory })}>
                {(Object.keys(CATEGORY_LABEL) as LineCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <MoneyInput compact label={`${line.label} amount`} value={line.cents} onChange={(c) => updateOfferLine(setOffer, line.id, { cents: c })} />
              <div>
                {line.category === "manufacturer_rebate" || line.category === "conditional_rebate" ? (
                  <select aria-label="Where the rebate is applied" className="field" value={line.applied ?? ""} onChange={(e) => updateOfferLine(setOffer, line.id, { applied: (e.target.value || null) as OfferLine["applied"] })}>
                    <option value="">Applied where?</option>
                    <option value="after_price">After selling price</option>
                    <option value="in_price">Folded into price</option>
                  </select>
                ) : line.category === "tax" || line.category === "dealer_discount" || line.category === "other" ? (
                  <span className="text-xs text-ink-2">{line.category === "other" ? "Not in totals" : "n/a"}</span>
                ) : line.category === "dealer_addon" ? (
                  <label className="tap flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={!!line.onSticker} onChange={(e) => updateOfferLine(setOffer, line.id, { onSticker: e.target.checked })} />
                    Printed on the sticker (already in the price)
                  </label>
                ) : (
                  <select aria-label="Taxable" className="field" value={line.taxable === null ? "" : line.taxable ? "yes" : "no"} onChange={(e) => updateOfferLine(setOffer, line.id, { taxable: e.target.value === "" ? null : e.target.value === "yes" })}>
                    <option value="">Taxable: rule default ({context.taxRule.taxableByCategory[line.category] ? "yes" : "no"})</option>
                    <option value="yes">Taxable: yes</option>
                    <option value="no">Taxable: no</option>
                  </select>
                )}
              </div>
            </LineRow>
          ))}
        </LineList>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_LINES.map((q) => (
            <button key={q.label} type="button" className="btn btn-sm" onClick={() => setOffer((o) => ({ ...o, lines: [...o.lines, { id: uid("ol"), label: q.label, cents: null, category: q.category, taxable: q.taxable, source: "typed", applied: q.category === "manufacturer_rebate" ? null : undefined }] }))}>
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
      <Section title="Financing and payment grid" intro="Financing third. Enter the grid as printed; every cell is solved for the APR it implies.">
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
      <Section title={`Flags (${report.flags.length})`} open intro="Live as you type. Each one names the move and what it costs.">
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

      {/* Desktop: live audit rail that stays in view while typing. */}
      <aside className="hidden lg:block lg:sticky lg:top-20 lg:mt-4" aria-label="Live audit">
        <div className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <VerdictPill band={report.verdict.band} />
            {report.verdict.score !== null && <span className="mono text-xs text-ink-3">score {report.verdict.score}/100</span>}
          </div>
          <p className="mt-2 text-sm">{report.verdict.headline}</p>
          <dl className="mt-4 grid gap-3">
            <div className="flex items-baseline justify-between">
              <dt className="eyebrow">All-in</dt>
              <dd className="num text-lg font-semibold">{formatCents(report.price.allIn.value)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="eyebrow">Discount off SRP</dt>
              <dd className="num">{formatCents(report.price.discountOffSrp.value)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="eyebrow">Computed tax</dt>
              <dd className="num">{formatCents(report.tax.computedTax.value)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="eyebrow">Tax difference</dt>
              <dd className={`num ${report.tax.difference.value !== null && Math.abs(report.tax.difference.value) > 1 ? "text-flag" : ""}`}>{formatCents(report.tax.difference.value)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="eyebrow">Corrected balance</dt>
              <dd className="num">{formatCents(report.tax.correctedBalance.value)}</dd>
            </div>
          </dl>
          {report.missing.length > 0 && <p className="mt-3 text-xs text-caution">Not yet quoted: {report.missing.slice(0, 4).join(", ")}{report.missing.length > 4 ? ` and ${report.missing.length - 4} more` : ""}.</p>}
          {report.flags.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
              {report.flags.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-xs">
                  <SeverityPill severity={f.severity} />
                  <span className="min-w-0">
                    <span className="block font-medium leading-snug">{f.title}</span>
                    {f.impactCents !== null && <span className="num text-ink-2">{formatCents(f.impactCents)}</span>}
                  </span>
                </li>
              ))}
              {report.flags.length > 6 && <li className="text-xs text-ink-3">and {report.flags.length - 6} more below</li>}
            </ul>
          )}
        </div>
      </aside>
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

function setLease(setOffer: (p: (o: Offer) => Offer) => void, patch: Partial<LeaseTerms>) {
  setOffer((o) => ({ ...o, lease: { ...(o.lease ?? EMPTY_LEASE), ...patch } }));
}

function eligiblePrograms(settings: Settings, dealType: "purchase" | "lease") {
  return settings.programs.filter((p) => p.eligible && p.appliesTo.includes(dealType));
}

function MoneyFactorInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : value.toFixed(5));
  const id = useId();
  const apr = value === null ? null : value * 24;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        Money factor
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className="field num"
        placeholder="0.00279"
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const n = Number(t.trim());
          if (t.trim() === "" || !Number.isFinite(n)) onChange(null);
          else onChange(n > 0.1 ? n / 2400 : n); // a typed APR percent (like 6.7) is converted
        }}
      />
      <p className="text-xs text-ink-3">{apr === null ? "Type the money factor, or an APR percent and it converts." : `${formatApr(apr)} APR equivalent`}</p>
    </div>
  );
}

/** Fill the form from a document extraction. Existing non-empty header fields are kept; sticker, offer lines and grid are replaced. */
function applyExtraction(x: Extraction, update: (p: (f: DealForm) => DealForm) => void) {
  update((f) => {
    const addr = [x.dealership.addressLine, [x.dealership.city, x.dealership.state].filter(Boolean).join(", "), x.dealership.zip].filter((p) => p && String(p).trim()).join(", ");
    const stickerLines = x.sticker.lines.map((l, i) => ({ id: `imp-s-${i}`, label: l.label, cents: toCents(l.amountDollars), group: (l.group === "unknown" ? "factory_option" : l.group) as StickerLine["group"], source: "sticker" as const }));
    const offerLines: OfferLine[] = x.offer.lines.map((l, i) => ({ id: `imp-o-${i}`, label: l.label, cents: toCents(l.amountDollars), category: l.category, taxable: null, source: "worksheet", applied: l.category === "manufacturer_rebate" || l.category === "conditional_rebate" ? null : undefined }));
    const grid = x.offer.paymentGrid.flatMap((c) => {
      const p = toCents(c.paymentDollars);
      const d = toCents(c.cashDownDollars);
      return p === null || d === null ? [] : [{ id: `g-${c.termMonths}-${d}`, termMonths: c.termMonths, cashDownCents: d, paymentCents: p, source: "worksheet" as const }];
    });
    const lease: LeaseTerms | null = x.lease.present
      ? {
          ...EMPTY_LEASE,
          termMonths: x.lease.termMonths ?? EMPTY_LEASE.termMonths,
          milesPerYear: x.lease.milesPerYear ?? EMPTY_LEASE.milesPerYear,
          agreedValueCents: toCents(x.lease.agreedValueDollars),
          capReductionCashCents: toCents(x.lease.capReductionDollars),
          acquisitionFeeCents: toCents(x.lease.acquisitionFeeDollars),
          residualCents: toCents(x.lease.residualDollars),
          residualPercent: x.lease.residualPercent === null ? null : x.lease.residualPercent > 1 ? x.lease.residualPercent / 100 : x.lease.residualPercent,
          moneyFactor: x.lease.moneyFactor,
          quotedPaymentCents: toCents(x.lease.monthlyPaymentDollars),
          dueAtSigningCents: toCents(x.lease.dueAtSigningDollars),
          dispositionFeeCents: toCents(x.lease.dispositionFeeDollars),
        }
      : f.offer.lease ?? null;
    return {
      ...f,
      dealershipName: f.dealershipName || x.dealership.name || "",
      salesperson: f.salesperson ?? x.dealership.salesperson ?? null,
      dealershipAddress: f.dealershipAddress ?? (addr || null),
      dealershipPhone: f.dealershipPhone ?? x.dealership.phone ?? null,
      dealershipWebsite: f.dealershipWebsite ?? x.dealership.website ?? null,
      vehicle: {
        ...f.vehicle,
        vin: f.vehicle.vin ?? x.vehicle.vin ?? null,
        year: f.vehicle.year ?? x.vehicle.year ?? null,
        make: f.vehicle.make ?? x.vehicle.make ?? null,
        model: f.vehicle.model ?? x.vehicle.model ?? null,
        trim: f.vehicle.trim ?? x.vehicle.trim ?? null,
        exteriorColor: f.vehicle.exteriorColor ?? x.vehicle.exteriorColor ?? null,
        interiorColor: f.vehicle.interiorColor ?? x.vehicle.interiorColor ?? null,
        stockNumber: f.vehicle.stockNumber ?? x.vehicle.stockNumber ?? null,
      },
      sticker: stickerLines.length > 0 ? { lines: stickerLines, totalSrpCents: toCents(x.sticker.totalSrpDollars) ?? f.sticker.totalSrpCents } : { ...f.sticker, totalSrpCents: f.sticker.totalSrpCents ?? toCents(x.sticker.totalSrpDollars) },
      offer: {
        ...f.offer,
        sellingPriceCents: toCents(x.offer.sellingPriceDollars) ?? f.offer.sellingPriceCents,
        statedDiscountCents: toCents(x.offer.statedDiscountDollars) ?? f.offer.statedDiscountCents ?? null,
        tradeAllowanceCents: toCents(x.offer.tradeAllowanceDollars) ?? f.offer.tradeAllowanceCents,
        cashDownCents: toCents(x.offer.cashDownDollars) ?? f.offer.cashDownCents,
        statedTotalCents: toCents(x.offer.statedTotalDollars) ?? f.offer.statedTotalCents ?? null,
        statedBalanceCents: toCents(x.offer.statedBalanceDollars) ?? f.offer.statedBalanceCents ?? null,
        lines: offerLines.length > 0 ? offerLines : f.offer.lines,
        paymentGrid: grid.length > 0 ? grid : f.offer.paymentGrid,
        dealType: x.lease.present ? "lease" : f.offer.dealType ?? "purchase",
        lease,
      },
    };
  });
}

function updateQuote(setOffer: (p: (o: Offer) => Offer) => void, id: string, patch: Partial<Offer["financing"][number]>) {
  setOffer((o) => ({ ...o, financing: o.financing.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
}

function Section({ title, open = false, intro, children }: { title: string; open?: boolean; intro?: string; children: React.ReactNode }) {
  return (
    <details open={open} className="card mt-4 p-4 sm:p-5">
      <summary className="tap -m-1 flex cursor-pointer list-none items-center justify-between rounded-sm p-1">
        <span>
          <span className="block text-base font-semibold">{title}</span>
          {intro && <span className="block text-sm font-normal text-ink-2">{intro}</span>}
        </span>
        <span aria-hidden="true" className="marker text-ink-3">
          <Icon.Chevron size={16} />
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function SourceSelect({ label, value, onChange }: { label: string; value: Source; onChange: (v: Source) => void }) {
  return (
    <select aria-label={label} className="field" value={value} onChange={(e) => onChange(e.target.value as Source)}>
      <option value="typed">Source: typed</option>
      <option value="sticker">Source: window sticker</option>
      <option value="worksheet">Source: dealer worksheet</option>
      <option value="assumption">Source: assumption</option>
    </select>
  );
}

function Text({ label, value, onChange, type = "text", hint, error, required, autoFocus }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; error?: string; required?: boolean; autoFocus?: boolean }) {
  const id = useId();
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
  const id = useId();
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
