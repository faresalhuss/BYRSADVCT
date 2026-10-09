"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSettings } from "@/db/actions";
import type { Settings } from "@/engine";

type Form = Settings & { activeTaxRuleId: string };

function pctText(v: number | null): string {
  return v === null ? "" : (v * 100).toFixed(2);
}
function pctParse(t: string): number | null {
  const n = Number(t.replace(/[%\s,]/g, ""));
  return t.trim() === "" || !Number.isFinite(n) ? null : n / 100;
}

export function SettingsForm({ initial, ruleOptions }: { initial: Form; ruleOptions: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initial);
  const [strong, setStrong] = useState(pctText(initial.thresholds.strongRatio));
  const [beats, setBeats] = useState(pctText(initial.thresholds.beatsBestRatio));
  const [pre, setPre] = useState(pctText(initial.preApprovalApr));
  const [junk, setJunk] = useState(initial.junkFeeList.join("\n"));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const s = pctParse(strong);
        const b = pctParse(beats);
        if (s === null || b === null) {
          setMsg("Thresholds must be percentages.");
          return;
        }
        const payload: Form = {
          ...form,
          thresholds: { ...form.thresholds, strongRatio: s, beatsBestRatio: b },
          preApprovalApr: pctParse(pre),
          junkFeeList: junk
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        };
        setMsg(null);
        start(async () => {
          const res = await saveSettings(payload);
          setMsg(res.ok ? "Saved" : `${res.error} ${res.issues ? Object.entries(res.issues).map(([k, v]) => `${k}: ${v}`).join("; ") : ""}`);
          if (res.ok) router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Threshold label</span>
        <input className="field" value={form.thresholds.label} onChange={(e) => setForm((f) => ({ ...f, thresholds: { ...f.thresholds, label: e.target.value } }))} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Pct label="Strong: all-in at or below (% of total SRP)" value={strong} onChange={setStrong} />
        <Pct label="Beats current best: at or below" value={beats} onChange={setBeats} />
        <Pct label="Your pre-approval APR" value={pre} onChange={setPre} placeholder="none" />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Active tax rule</span>
          <select className="field" value={form.activeTaxRuleId} onChange={(e) => setForm((f) => ({ ...f, activeTaxRuleId: e.target.value }))}>
            {ruleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Benchmark stale after (days)</span>
          <input type="number" className="field num" value={form.benchmarkStaleDays} onChange={(e) => setForm((f) => ({ ...f, benchmarkStaleDays: Number(e.target.value) }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tax rule re-verify after (days)</span>
          <input type="number" className="field num" value={form.taxRuleStaleDays} onChange={(e) => setForm((f) => ({ ...f, taxRuleStaleDays: Number(e.target.value) }))} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Junk-fee list (one per line, matched against line labels)</span>
        <textarea className="field min-h-32 py-2" value={junk} onChange={(e) => setJunk(e.target.value)} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Published promo rates</legend>
        {form.promoRates.map((p, i) => (
          <div key={p.id} className="grid gap-2 rounded-md border border-line p-2 sm:grid-cols-5">
            <input aria-label="Promo label" className="field" value={p.label} placeholder="Toyota 4Runner APR cash" onChange={(e) => setForm((f) => ({ ...f, promoRates: f.promoRates.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))} />
            <input aria-label="Promo APR percent" className="field num" inputMode="decimal" value={(p.apr * 100).toString()} onChange={(e) => setForm((f) => ({ ...f, promoRates: f.promoRates.map((x, j) => (j === i ? { ...x, apr: (pctParse(e.target.value) ?? 0) } : x)) }))} />
            <input aria-label="Promo term months (blank for any)" type="number" className="field num" value={p.termMonths ?? ""} placeholder="any term" onChange={(e) => setForm((f) => ({ ...f, promoRates: f.promoRates.map((x, j) => (j === i ? { ...x, termMonths: e.target.value ? Number(e.target.value) : null } : x)) }))} />
            <input aria-label="Promo source" className="field" value={p.source} placeholder="toyota.com offers" onChange={(e) => setForm((f) => ({ ...f, promoRates: f.promoRates.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)) }))} />
            <div className="flex gap-1">
              <input aria-label="Promo as-of date" type="date" className="field" value={p.asOf} onChange={(e) => setForm((f) => ({ ...f, promoRates: f.promoRates.map((x, j) => (j === i ? { ...x, asOf: e.target.value } : x)) }))} />
              <button type="button" className="btn btn-quiet btn-sm" aria-label="Remove promo rate" onClick={() => setForm((f) => ({ ...f, promoRates: f.promoRates.filter((_, j) => j !== i) }))}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-sm self-start" onClick={() => setForm((f) => ({ ...f, promoRates: [...f.promoRates, { id: `promo-${Date.now()}`, label: "", apr: 0.0499, termMonths: null, source: "", asOf: new Date().toISOString().slice(0, 10) }] }))}>
          Add promo rate
        </button>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving" : "Save settings"}
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

function Pct({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = `s-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input id={id} type="text" inputMode="decimal" className="field num pr-8 text-right" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-2">
          %
        </span>
      </div>
    </div>
  );
}
