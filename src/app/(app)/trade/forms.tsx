"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/editor/money-input";
import { addOutsideOffer, saveTradeProfile } from "@/db/actions";

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
        <span className="text-sm font-medium">Vehicle</span>
        <input className="field" value={form.vehicle.description ?? ""} placeholder="2022 Tesla Model 3 Long Range" onChange={(e) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, description: e.target.value || null } }))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Trade VIN</span>
        <input className="field num uppercase" maxLength={17} value={form.vehicle.vin ?? ""} onChange={(e) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, vin: e.target.value.toUpperCase() || null } }))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Lender</span>
        <input className="field" value={form.vehicle.lender ?? ""} onChange={(e) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, lender: e.target.value || null } }))} />
      </label>
      <MoneyInput label="Payoff amount" value={form.payoffCents} onChange={(c) => setForm((f) => ({ ...f, payoffCents: c }))} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Payoff good through</span>
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

export function OutsideOfferForm() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [cents, setCents] = useState<number | null>(null);
  const [expiresOn, setExpiresOn] = useState("");
  const [contingent, setContingent] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (cents === null) {
          setMsg("Enter the offer amount.");
          return;
        }
        setMsg(null);
        start(async () => {
          const res = await addOutsideOffer({ source, cents, expiresOn: expiresOn || null, contingentOnInspection: contingent, note: note || null });
          if (!res.ok) {
            setMsg(res.error);
            return;
          }
          setSource("");
          setCents(null);
          setExpiresOn("");
          setContingent(false);
          setNote("");
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Source</span>
        <input className="field" value={source} required placeholder="CarMax" onChange={(e) => setSource(e.target.value)} />
      </label>
      <MoneyInput label="Offer amount" value={cents} onChange={setCents} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Expires</span>
        <input type="date" className="field" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Note</span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="tap flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={contingent} onChange={(e) => setContingent(e.target.checked)} />
        Contingent on inspection
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Adding" : "Add outside offer"}
        </button>
        {msg && (
          <span className="text-sm text-flag" role="alert">
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}
