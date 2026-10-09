"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveTaxRule } from "@/db/actions";
import type { LineCategory, TaxRule } from "@/engine";

const CATS: { key: LineCategory; label: string }[] = [
  { key: "dealer_fee", label: "Dealer fees (doc, ELT) taxed by default" },
  { key: "dealer_addon", label: "Dealer add-ons taxed by default" },
  { key: "gov_fee", label: "Government fees taxed by default" },
  { key: "other", label: "Other lines taxed by default" },
];

export function TaxRuleForm({ initial }: { initial: TaxRule }) {
  const router = useRouter();
  const [form, setForm] = useState<TaxRule>(initial);
  const [rateText, setRateText] = useState((initial.rate * 100).toString());
  const [activate, setActivate] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const rate = Number(rateText) / 100;
        if (!Number.isFinite(rate)) {
          setMsg("Rate must be a percentage.");
          return;
        }
        setMsg(null);
        start(async () => {
          const res = await saveTaxRule({ ...form, rate }, activate);
          setMsg(res.ok ? "Saved" : `${res.error} ${res.issues ? Object.entries(res.issues).map(([k, v]) => `${k}: ${v}`).join("; ") : ""}`);
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Rule id</span>
          <input className="field" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Version</span>
          <input type="number" className="field num" value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: Number(e.target.value) }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input className="field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">State</span>
          <input className="field uppercase" maxLength={2} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Rate (%)</span>
          <input className="field num" inputMode="decimal" value={rateText} onChange={(e) => setRateText(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Verified on</span>
          <input type="date" className="field" value={form.verifiedOn} onChange={(e) => setForm((f) => ({ ...f, verifiedOn: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">Source URL</span>
          <input type="url" className="field" value={form.sourceUrl} onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))} />
        </label>
      </div>
      <label className="tap flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.tradeReducesBase} onChange={(e) => setForm((f) => ({ ...f, tradeReducesBase: e.target.checked }))} />
        Trade allowance reduces the taxable base
      </label>
      <label className="tap flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.rebatesReduceBase} onChange={(e) => setForm((f) => ({ ...f, rebatesReduceBase: e.target.checked }))} />
        Manufacturer rebates reduce the taxable base
      </label>
      <label className="tap flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.rebateRuleVerified} onChange={(e) => setForm((f) => ({ ...f, rebateRuleVerified: e.target.checked }))} />
        Rebate rule verified against Georgia DOR Form MV-7D
      </label>
      {CATS.map((c) => (
        <label key={c.key} className="tap flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.taxableByCategory[c.key]} onChange={(e) => setForm((f) => ({ ...f, taxableByCategory: { ...f.taxableByCategory, [c.key]: e.target.checked } }))} />
          {c.label}
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Notes</span>
        <textarea className="field min-h-24 py-2" value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </label>
      <label className="tap flex items-center gap-2 text-sm">
        <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
        Make this the active rule
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving" : "Save rule"}
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
