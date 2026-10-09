"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/editor/money-input";
import { addBenchmark } from "@/db/actions";

export function BenchmarkForm() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [observedOn, setObservedOn] = useState("");
  const [totalSrp, setTotalSrp] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [kind, setKind] = useState<"paid" | "advertised">("paid");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (price === null) {
          setMsg("Enter the price.");
          return;
        }
        setMsg(null);
        start(async () => {
          const res = await addBenchmark({ source, url: url || null, observedOn, totalSrpCents: totalSrp, priceCents: price, kind, note: note || null });
          if (!res.ok) {
            setMsg(res.error + (res.issues ? ` (${Object.values(res.issues).join("; ")})` : ""));
            return;
          }
          setSource("");
          setUrl("");
          setObservedOn("");
          setTotalSrp(null);
          setPrice(null);
          setNote("");
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Source</span>
        <input className="field" value={source} required placeholder="4Runner forum, dealer site, friend" onChange={(e) => setSource(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">URL (optional)</span>
        <input type="url" className="field" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Observed on</span>
        <input type="date" className="field" value={observedOn} required onChange={(e) => setObservedOn(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Kind</span>
        <select className="field" value={kind} onChange={(e) => setKind(e.target.value as "paid" | "advertised")}>
          <option value="paid">Price paid</option>
          <option value="advertised">Advertised</option>
        </select>
      </label>
      <MoneyInput label="Total SRP of that vehicle" value={totalSrp} onChange={setTotalSrp} />
      <MoneyInput label="Price (all-in dealer price if known)" value={price} onChange={setPrice} />
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm font-medium">Note</span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Adding" : "Add benchmark"}
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
