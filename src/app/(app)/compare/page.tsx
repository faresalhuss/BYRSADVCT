import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { compareDeals, formatApr, formatCents, formatPercent, type CompareMode, type CompareRow } from "@/engine";
import { evaluate, getEvalContext, listDeals } from "@/db/queries";
import { DealPicker } from "./deal-picker";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage(props: PageProps<"/compare">) {
  return (
    <main>
      <h1 className="text-3xl">Compare</h1>
      <p className="mt-1 text-sm text-ink-2">Two to six deals, normalized. Price alone first, then with your trade.</p>
      <Suspense fallback={<p className="mt-4 text-ink-2">Loading</p>}>
        <Compare searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

function cell(row: CompareRow, v: number | null): string {
  if (v === null) return "not yet quoted";
  switch (row.unit) {
    case "cents":
      return formatCents(v);
    case "ratio":
      return formatPercent(v);
    case "rate":
      return formatApr(v);
    default:
      return String(v);
  }
}

async function Compare({ searchParams }: { searchParams: PageProps<"/compare">["searchParams"] }) {
  const sp = await searchParams;
  const mode: CompareMode = sp.mode === "with_trade" ? "with_trade" : "price_only";
  const idsParam = typeof sp.ids === "string" ? sp.ids : Array.isArray(sp.ids) ? sp.ids.join(",") : "";
  const requested = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const [deals, ctx] = await Promise.all([listDeals(), getEvalContext()]);
  const selected = requested.length > 0 ? deals.filter((d) => requested.includes(d.deal.id)) : deals.slice(0, 6);
  const reports = selected.map((d) => evaluate(d, ctx));
  const canCompare = reports.length >= 2 && reports.length <= 6;
  const result = canCompare ? compareDeals(reports, mode) : null;
  const query = (m: CompareMode) => `/compare?mode=${m}${requested.length ? `&ids=${requested.join(",")}` : ""}`;

  return (
    <div className="mt-4">
      <DealPicker deals={deals.map((d) => ({ id: d.deal.id, name: d.deal.dealership_name }))} selected={selected.map((d) => d.deal.id)} mode={mode} />
      {!canCompare ? (
        <div className="card mt-4 p-6">
          <p className="font-medium">{deals.length < 2 ? "You need at least two deals to compare." : "Pick two to six deals above."}</p>
          {deals.length < 2 && (
            <p className="mt-1 text-ink-2">
              <Link href="/deals/new" className="text-accent underline">
                Add another deal
              </Link>
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-2" role="tablist" aria-label="Comparison mode">
            <Link href={query("price_only")} role="tab" aria-selected={mode === "price_only"} className={`btn btn-sm ${mode === "price_only" ? "btn-primary" : ""}`}>
              Price only
            </Link>
            <Link href={query("with_trade")} role="tab" aria-selected={mode === "with_trade"} className={`btn btn-sm ${mode === "with_trade" ? "btn-primary" : ""}`}>
              With trade
            </Link>
          </div>

          <section className="card mt-4 p-4">
            <h2 className="text-lg">{mode === "price_only" ? "Ranked on all-in dealer price, trade excluded" : "Ranked on net cost after trading to each dealer"}</h2>
            <ol className="mt-2 text-sm">
              {result!.ranking
                .slice()
                .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                .map((r) => {
                  const name = result!.names[result!.dealIds.indexOf(r.dealId)];
                  const push = result!.push.find((p) => p.dealId === r.dealId);
                  return (
                    <li key={r.dealId} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line/70 py-2">
                      <span>
                        <span className="num mr-2 text-ink-2">{r.rank === null ? "—" : `#${r.rank}`}</span>
                        <Link href={`/deals/${r.dealId}`} className="underline">
                          {name}
                        </Link>
                        {!r.complete && <span className="ml-2 pill pill-info">incomplete</span>}
                      </span>
                      <span className="num">
                        {formatCents(r.metricCents)}
                        {push && push.gapCents > 0 && (
                          <span className="ml-2 text-flag">
                            push down by {formatCents(push.gapCents)} to tie #1
                          </span>
                        )}
                        {r.rank === 1 && <span className="ml-2 pill pill-good">best</span>}
                      </span>
                    </li>
                  );
                })}
            </ol>
          </section>

          <div className="card mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2">
                    <th scope="col" className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left font-medium">
                      Line
                    </th>
                    {result!.names.map((n, i) => (
                      <th key={result!.dealIds[i]} scope="col" className="min-w-36 px-3 py-2 text-right font-medium">
                        <Link href={`/deals/${result!.dealIds[i]}`} className="underline">
                          {n}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result!.rows.map((row) => (
                    <tr key={row.key} className="border-t border-line/70">
                      <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-normal">
                        {row.label}
                      </th>
                      {row.values.map((v, i) => {
                        const best = row.bestIndex === i;
                        return (
                          <td key={i} className={`num px-3 py-2 text-right ${best ? "bg-good-bg font-medium text-good" : ""} ${v === null ? "text-ink-2" : ""}`}>
                            {cell(row, v)}
                            {best && (
                              <span className="ml-1" aria-label="best in row">
                                &#10003;
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
