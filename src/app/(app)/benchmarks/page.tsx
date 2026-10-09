import type { Metadata } from "next";
import { Suspense } from "react";
import { deleteBenchmark } from "@/db/actions";
import { getBenchmarks, getSettingsBundle, listDeals, getEvalContext, evaluate } from "@/db/queries";
import { daysBetween, formatCents, formatPercent } from "@/engine";
import { formatDate, todayIso } from "@/lib/dates";
import { BenchmarkForm } from "./form";

export const metadata: Metadata = { title: "Benchmarks" };

export default function BenchmarksPage() {
  return (
    <main>
      <h1 className="text-3xl">Benchmarks</h1>
      <p className="mt-1 text-sm text-ink-2">Market data points you enter yourself, each with a source and a date. Nothing here is invented.</p>
      <Suspense fallback={<p className="mt-4 text-ink-2">Loading</p>}>
        <Benchmarks />
      </Suspense>
    </main>
  );
}

async function Benchmarks() {
  const [benchmarks, s, deals, ctx] = await Promise.all([getBenchmarks(), getSettingsBundle(), listDeals(), getEvalContext()]);
  const today = todayIso();
  const ratios = benchmarks.map((b) => (b.totalSrpCents ? b.priceCents / b.totalSrpCents : null)).filter((r): r is number => r !== null).sort((a, b) => a - b);
  const reports = deals.map((d) => ({ name: d.deal.dealership_name, ratio: evaluate(d, ctx).price.allInRatio.value }));
  const percentile = (r: number) => (ratios.length === 0 ? null : Math.round((ratios.filter((x) => x <= r).length / ratios.length) * 100));
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="card p-4">
        <h2 className="text-lg">Add a data point</h2>
        <BenchmarkForm />
      </section>
      <section className="card p-4">
        <h2 className="text-lg">Your deals against the benchmarks</h2>
        {ratios.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Add benchmarks with a total SRP to see where each deal falls.</p>
        ) : (
          <ul className="mt-2 text-sm">
            {reports.map((r) => (
              <li key={r.name} className="flex justify-between border-t border-line/70 py-1">
                <span>{r.name}</span>
                <span className="num">
                  {r.ratio === null ? "incomplete" : `${formatPercent(r.ratio)} · lower than ${100 - (percentile(r.ratio) ?? 0)}% of benchmarks`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-2">Benchmarks older than {s.settings.benchmarkStaleDays} days are marked stale.</p>
      </section>
      <section className="card p-4 lg:col-span-2">
        <h2 className="text-lg">Data points ({benchmarks.length})</h2>
        {benchmarks.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">None yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[640px] text-sm">
              <thead className="text-xs uppercase text-ink-2">
                <tr>
                  <th className="text-left font-medium">Source</th>
                  <th className="text-left font-medium">Observed</th>
                  <th className="text-left font-medium">Kind</th>
                  <th className="text-right font-medium">Total SRP</th>
                  <th className="text-right font-medium">Price</th>
                  <th className="text-right font-medium">% of SRP</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((b) => {
                  const stale = daysBetween(b.observedOn, today) > s.settings.benchmarkStaleDays;
                  return (
                    <tr key={b.id} className="border-t border-line/70">
                      <td className="py-1 pr-2">
                        {b.url ? (
                          <a href={b.url} className="underline" target="_blank" rel="noreferrer">
                            {b.source}
                          </a>
                        ) : (
                          b.source
                        )}
                        {b.note && <span className="block text-xs text-ink-2">{b.note}</span>}
                      </td>
                      <td className="py-1 pr-2">
                        {formatDate(b.observedOn)}
                        {stale && <span className="ml-2 pill pill-caution">stale</span>}
                      </td>
                      <td className="py-1 pr-2">{b.kind}</td>
                      <td className="num py-1 text-right">{formatCents(b.totalSrpCents)}</td>
                      <td className="num py-1 text-right">{formatCents(b.priceCents)}</td>
                      <td className="num py-1 text-right">{b.totalSrpCents ? formatPercent(b.priceCents / b.totalSrpCents) : "—"}</td>
                      <td className="py-1 text-right">
                        <form action={deleteBenchmark.bind(null, b.id)}>
                          <button type="submit" className="btn btn-quiet btn-sm text-ink-2">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
