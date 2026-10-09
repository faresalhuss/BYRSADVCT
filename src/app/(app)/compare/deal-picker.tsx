"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DealPicker({ deals, selected, mode }: { deals: { id: string; name: string }[]; selected: string[]; mode: string }) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>(selected);
  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 6 ? cur : [...cur, id]));
  return (
    <fieldset className="card p-3">
      <legend className="px-1 text-sm font-medium">Deals to compare ({ids.length} of 6)</legend>
      <div className="flex flex-wrap gap-2">
        {deals.map((d) => {
          const on = ids.includes(d.id);
          return (
            <label key={d.id} className={`tap inline-flex cursor-pointer items-center gap-2 rounded-sm border px-3 text-sm ${on ? "border-accent bg-accent-bg text-accent" : "border-line"}`}>
              <input type="checkbox" className="accent-[var(--accent)]" checked={on} onChange={() => toggle(d.id)} />
              {d.name}
            </label>
          );
        })}
      </div>
      <button type="button" className="btn btn-sm mt-3" disabled={ids.length < 2} onClick={() => router.push(`/compare?mode=${mode}&ids=${ids.join(",")}`)}>
        Compare selected
      </button>
    </fieldset>
  );
}
