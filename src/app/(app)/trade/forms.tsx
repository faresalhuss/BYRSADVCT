"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/editor/money-input";
import { addOutsideOffer, saveTradeProfile, updateOutsideOffer } from "@/db/actions";

interface ProfileInitial {
  payoffCents: number | null;
  payoffGoodThrough: string | null;
  vinAndOwnerRecorded: boolean;
  vehicle: { vin?: string | null; year?: number | null; description?: string | null; lender?: string | null };
}

export function TradeProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await saveTradeProfile(form);
          setMsg(res.ok ? "Saved" : res.error);
          if (res.ok) router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="label">Vehicle</span>
        <input className="field" value={form.vehicle.description ?? ""} placeholder="2022 Tesla Model 3 Long Range" onChange={(e) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, description: e.target.value || null } }))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Trade VIN</span>
        <input className="field mono uppercase" maxLength={17} value={form.vehicle.vin ?? ""} onChange={(e) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, vin: e.target.value.toUpperCase() || null } }))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Lender</span>
        <input className="field" value={form.vehicle.lender ?? ""} onChange={(e) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, lender: e.target.value || null } }))} />
      </label>
      <MoneyInput label="Payoff amount" value={form.payoffCents} onChange={(c) => setForm((f) => ({ ...f, payoffCents: c }))} hint="From the lender's payoff letter, not your statement balance." />
      <label className="flex flex-col gap-1">
        <span className="label">Payoff good through</span>
        <input type="date" className="field" value={form.payoffGoodThrough ?? ""} onChange={(e) => setForm((f) => ({ ...f, payoffGoodThrough: e.target.value || null }))} />
      </label>
      <label className="tap flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.vinAndOwnerRecorded} onChange={(e) => setForm((f) => ({ ...f, vinAndOwnerRecorded: e.target.checked }))} />
        Trade VIN and owner will be recorded on the dealer paperwork (required for the Georgia TAVT trade credit)
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving" : "Save"}
        </button>
        {msg && (
          <span className="text-sm text-ink-2" role="status">
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}

export interface OfferDraft {
  source: string;
  cents: number | null;
  expiresOn: string;
  contingentOnInspection: boolean;
  note: string;
}

const EMPTY: OfferDraft = { source: "", cents: null, expiresOn: "", contingentOnInspection: false, note: "" };

/** Add or edit an outside offer. Pass `editing` to switch to update mode. */
export function OutsideOfferForm({ editing, onDone }: { editing?: OfferDraft & { id: string }; onDone?: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<OfferDraft>(editing ? { source: editing.source, cents: editing.cents, expiresOn: editing.expiresOn, contingentOnInspection: editing.contingentOnInspection, note: editing.note } : EMPTY);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.cents === null) {
          setMsg("Enter the offer amount.");
          return;
        }
        setMsg(null);
        start(async () => {
          const payload = { source: form.source, cents: form.cents!, expiresOn: form.expiresOn || null, contingentOnInspection: form.contingentOnInspection, note: form.note || null };
          const res = editing ? await updateOutsideOffer({ id: editing.id, ...payload }) : await addOutsideOffer(payload);
          if (!res.ok) {
            setMsg(res.error);
            return;
          }
          if (!editing) setForm(EMPTY);
          onDone?.();
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="label">Source</span>
        <input className="field" value={form.source} required placeholder="CarMax, Carvana, Tesla, private buyer" onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
      </label>
      <MoneyInput label="Offer amount" value={form.cents} onChange={(c) => setForm((f) => ({ ...f, cents: c }))} />
      <label className="flex flex-col gap-1">
        <span className="label">Expires</span>
        <input type="date" className="field" value={form.expiresOn} onChange={(e) => setForm((f) => ({ ...f, expiresOn: e.target.value }))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Note</span>
        <input className="field" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
      </label>
      <label className="tap flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={form.contingentOnInspection} onChange={(e) => setForm((f) => ({ ...f, contingentOnInspection: e.target.checked }))} />
        Contingent on inspection
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className={`btn ${editing ? "btn-primary" : ""}`} disabled={pending}>
          {pending ? "Saving" : editing ? "Save changes" : "Add outside offer"}
        </button>
        {editing && (
          <button type="button" className="btn btn-quiet" onClick={onDone}>
            Cancel
          </button>
        )}
        {msg && (
          <span className="text-sm text-flag" role="alert">
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}

/** One saved offer with an inline Edit toggle. */
export function OutsideOfferItem({ offer, children }: { offer: OfferDraft & { id: string }; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="card p-3">
        <OutsideOfferForm editing={offer} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 border-t border-line py-3 text-sm first:border-t-0">
      {children}
      <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
        Edit
      </button>
    </li>
  );
}
