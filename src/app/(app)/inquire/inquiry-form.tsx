"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { MoneyInput } from "@/components/editor/money-input";
import { VinField } from "@/components/editor/vin-field";
import { formatPhoneInput } from "@/lib/phone";
import { US_STATES } from "@/content/states";
import { createInquiry, updateInquiry } from "@/db/inquiry-actions";
import type { InquiryForm } from "@/domain/schemas";
import { checkVin, formatPercent, ratio, type VehicleDecoded } from "@/engine";

export function InquiryEditor({ mode, id, initial }: { mode: "new" | "edit"; id: string | null; initial: InquiryForm }) {
  const router = useRouter();
  const [form, setForm] = useState<InquiryForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [decoded, setDecoded] = useState<VehicleDecoded | null>(null);
  const vin = checkVin(form.vehicle.vin);
  const pct = ratio(form.advertisedPriceCents, form.msrpCents);

  // Safari and Chrome restore a page from the back/forward cache with its old React state intact.
  // A restored "new" form must start blank again, not show the listing that was just saved.
  useEffect(() => {
    if (mode !== "new") return;
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setForm(initial);
        setDecoded(null);
        setError(null);
        setIssues({});
      }
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [mode, initial]);

  function save() {
    setError(null);
    setIssues({});
    start(async () => {
      const res = mode === "new" ? await createInquiry(form) : await updateInquiry(id!, form);
      if (!res.ok) {
        setError(res.error);
        setIssues(res.issues ?? {});
        return;
      }
      if (mode === "new") setForm(initial);
      // replace, so Back from the saved listing does not land on a filled-in create form
      router.replace(`/inquire/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-4 sm:p-5">
        <h2>Dealership</h2>
        <div className="mt-3 grid gap-3">
          <Field label="Dealership name" value={form.dealershipName} onChange={(v) => setForm((f) => ({ ...f, dealershipName: v }))} error={issues.dealershipName} required />
          <Field label="Street address" value={form.addressLine ?? ""} onChange={(v) => setForm((f) => ({ ...f, addressLine: v || null }))} autoComplete="street-address" />
          <div className="grid grid-cols-[1fr_6.5rem_6rem] gap-2">
            <Field label="City" value={form.city ?? ""} onChange={(v) => setForm((f) => ({ ...f, city: v || null }))} />
            <StateSelect value={form.state ?? ""} onChange={(v) => setForm((f) => ({ ...f, state: v || null }))} />
            <Field label="ZIP" value={form.zip ?? ""} onChange={(v) => setForm((f) => ({ ...f, zip: v || null }))} inputMode="numeric" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone" type="tel" value={form.phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, phone: formatPhoneInput(v) || null }))} autoComplete="tel" hint="Formatted as you type; tap it on the listing to call." />
            <Field label="Salesperson" value={form.salesperson ?? ""} onChange={(v) => setForm((f) => ({ ...f, salesperson: v || null }))} />
          </div>
          <Field label="Dealer website" type="url" value={form.website ?? ""} onChange={(v) => setForm((f) => ({ ...f, website: v || null }))} />
          <Field label="Listing link" type="url" value={form.listingUrl ?? ""} onChange={(v) => setForm((f) => ({ ...f, listingUrl: v || null }))} hint="Paste the vehicle detail page. It stays with the inquiry and the deal." />
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <h2>Vehicle and price</h2>
        <div className="mt-3 grid gap-3">
          <VinField
            id="inquiry-vin"
            value={form.vehicle.vin ?? ""}
            check={vin}
            decoded={decoded}
            entered={form.vehicle}
            onChange={(v) => {
              const next = v.toUpperCase();
              if (next.trim() !== (form.vehicle.vin ?? "").trim()) setDecoded(null);
              setForm((f) => ({ ...f, vehicle: { ...f.vehicle, vin: next || null } }));
            }}
            onDecoded={setDecoded}
            onUse={(field, value) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, [field]: value } }))}
          />
          <Field label="Stock number" value={form.vehicle.stockNumber ?? ""} onChange={(v) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, stockNumber: v || null } }))} mono />
          <div className="grid grid-cols-[5rem_1fr_1fr] gap-2">
            <Field label="Year" type="number" value={form.vehicle.year?.toString() ?? ""} onChange={(v) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, year: v ? Number(v) : null } }))} />
            <Field label="Make" value={form.vehicle.make ?? ""} onChange={(v) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, make: v || null } }))} />
            <Field label="Model" value={form.vehicle.model ?? ""} onChange={(v) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, model: v || null } }))} />
          </div>
          <Field label="Trim" value={form.vehicle.trim ?? ""} onChange={(v) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, trim: v || null } }))} />
          <Field label="Powertrain" value={form.vehicle.powertrain ?? ""} onChange={(v) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, powertrain: v || null } }))} hint="Gas i-FORCE 2.4L turbo, or i-FORCE MAX hybrid" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Exterior color" value={form.vehicle.exteriorColor ?? ""} onChange={(v) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, exteriorColor: v || null } }))} />
            <Field label="Interior color" value={form.vehicle.interiorColor ?? ""} onChange={(v) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, interiorColor: v || null } }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyInput label="Advertised price" value={form.advertisedPriceCents} onChange={(c) => setForm((f) => ({ ...f, advertisedPriceCents: c }))} hint="The internet price on the listing. Becomes the starting selling price when converted." />
            <MoneyInput label="Total SRP / MSRP on the listing" value={form.msrpCents} onChange={(c) => setForm((f) => ({ ...f, msrpCents: c }))} hint={pct !== null ? `Advertised is ${formatPercent(pct)} of sticker.` : undefined} />
          </div>
          <Field label="Stock date (if shown)" type="date" value={form.vehicle.stockDate ?? ""} onChange={(v) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, stockDate: v || null } }))} />
          <label className="flex flex-col gap-1">
            <span className="label">Notes</span>
            <textarea className="field min-h-24" value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))} placeholder="What to ask, who to ask for, anything odd about the listing." />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3 lg:col-span-2">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving" : mode === "new" ? "Save listing" : "Save changes"}
        </button>
        {error && (
          <span className="text-sm text-flag" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

function StateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label">
        State
      </label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">State</option>
        {US_STATES.map((s) => (
          <option key={s.code} value={s.code}>
            {s.code}
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", hint, error, required, mono, maxLength, inputMode, autoComplete, invalid }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; error?: string; required?: boolean; mono?: boolean; maxLength?: number; inputMode?: "numeric" | "decimal" | "text"; autoComplete?: string; invalid?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} type={type} className={`field ${mono ? "mono uppercase" : ""}`} value={value} required={required} maxLength={maxLength} inputMode={inputMode} autoComplete={autoComplete} aria-invalid={error || invalid ? "true" : undefined} aria-describedby={hint || error ? `${id}-d` : undefined} onChange={(e) => onChange(e.target.value)} />
      {(hint || error) && (
        <p id={`${id}-d`} className={`text-xs ${error || invalid ? "text-flag" : "text-ink-3"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
