"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSettings } from "@/db/actions";
import type { RebateProgram, Settings } from "@/engine";
import { formatCents } from "@/engine";
import { formatDate } from "@/lib/dates";

type Form = Settings & { activeTaxRuleId: string };

export function ProgramsForm({ initial }: { initial: Form }) {
  const router = useRouter();
  const [programs, setPrograms] = useState<RebateProgram[]>(initial.programs);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(programs) !== JSON.stringify(initial.programs);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveSettings({ ...initial, programs });
      setMsg(res.ok ? "Saved" : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {programs.map((p, i) => (
          <li key={p.id} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{p.label}</p>
                <span className="pill pill-accent pill-plain num">{formatCents(p.amountCents, { cents: false })}</span>
                {p.endsOn && <span className="text-xs text-ink-3">through {formatDate(p.endsOn)}</span>}
              </div>
              <p className="mt-1 text-sm text-ink-2">{p.eligibility}</p>
              {p.notes && <p className="mt-1 text-sm text-ink-3">{p.notes}</p>}
              <p className="mt-1 text-xs text-ink-3">
                {p.requiresTfsFinancing ? "Requires SETF financing or lease. " : ""}
                {p.stacksWithSpecialApr ? "Stacks with special APR. " : "Not combinable with special APR. "}
                Applies to {p.appliesTo.join(" and ")}.{" "}
                <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                  Source
                </a>
                , verified {formatDate(p.verifiedOn)}.
              </p>
            </div>
            <label className="tap flex items-center gap-2 self-start text-sm sm:justify-self-end">
              <input type="checkbox" checked={p.eligible} onChange={(e) => setPrograms((ps) => ps.map((x, j) => (j === i ? { ...x, eligible: e.target.checked } : x)))} />
              I qualify
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving" : "Save eligibility"}
        </button>
        {msg && (
          <span className="text-sm text-ink-2" role="status">
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
