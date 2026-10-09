import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmForm } from "@/components/confirm-form";
import { Metric, PageHeader, Section } from "@/components/ui";
import { deleteBenchmark } from "@/db/actions";
import { evaluate, getBenchmarks, getEvalContext, getSettingsBundle, listDeals } from "@/db/queries";
import { benchmarkRatios, daysBetween, formatCents, formatPercent, percentileOf } from "@/engine";
import { formatDate, todayIso } from "@/lib/dates";
import { BenchmarkForm } from "./form";

export const metadata: Metadata = { title: "Benchmarks" };

type View = "purchase" | "trade";

export default function BenchmarksPage(props: PageProps<"/benchmarks">) {
  return (
    <main>
      <PageHeader title="Benchmarks" description="Real market data points with a source and a date. Nothing here is invented; the research set was gathered on 2026-10-09 and you can add your own." />
      <Suspense fallback={<div className="skeleton h-64" aria-hidden="true" />}>
        <Benchmarks searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Benchmarks({ searchParams }: { searchParams: PageProps<"/benchmarks">["searchParams"] }) {
  const sp = await searchParams;
  const view: View = sp.view === "trade" ? "trade" : "purchase";
  const [benchmarks, s, deals, ctx] = await Promise.all([getBenchmarks(), getSettingsBundle(), listDeals(), getEvalContext()]);
  const today = todayIso();
  const rows = benchmarks.filter((b) => (b.vehicle ?? "purchase") === view);
  const ratios = benchmarkRatios(rows);
  const reports = deals.map((d) => {
    const r = evaluate(d, ctx);
    return { id: d.deal.id, name: d.deal.dealership_name, ratio: r.price.allInRatio.value, allowance: r.trade.allowance.value };
  });
  const prices = rows.map((b) => b.priceCents).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)]! : null;
  const bestRatio = ratios.length ? ratios[0]! : null;

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-1 rounded-md border border-line bg-surface p-1" aria-label="Which vehicle">
        {(
          [
            ["purchase", "2026 4Runner TRD Off-Road Premium"],
            ["trade", "2022 Tesla Model 3 Long Range"],
          ] as const
        ).map(([v, label]) => (
          <Link key={v} href={`/benchmarks?view=${v}`} aria-current={view === v ? "page" : undefined} className={`tap flex flex-1 items-center justify-center rounded-sm px-3 text-center text-sm font-medium ${view === v ? "bg-surface-3 text-ink" : "text-ink-2 hover:text-ink"}`}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <Metric label={view === "purchase" ? "Data points" : "Value points"}>{rows.length}</Metric>
        </div>
        <div className="card p-4">
          <Metric label={view === "purchase" ? "Lowest price as % of sticker" : "Median value"} hint={view === "purchase" ? "best ratio in the set" : "across the saved points"}>
            {view === "purchase" ? formatPercent(bestRatio) : formatCents(median, { cents: false })}
          </Metric>
        </div>
        <div className="card p-4">
          <Metric label="Attainable target" hint={view === "purchase" ? "from the research summary" : "KBB trade-in, good condition"}>
            {view === "purchase" ? "94.5% to 95.5%" : formatCents(2451000, { cents: false })}
          </Metric>
        </div>
      </div>

      {view === "purchase" ? (
        <Section id="deals-vs" title="Your deals against the market" intro="Lower is better. The percentile says how many researched data points your all-in beats.">
          {ratios.length === 0 ? (
            <p className="text-sm text-ink-2">Add benchmarks with a total SRP to place your deals.</p>
          ) : (
            <ul className="text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 border-t border-line py-2 first:border-t-0">
                  <Link href={`/deals/${r.id}`} className="underline">
                    {r.name}
                  </Link>
                  <span className="num">{r.ratio === null ? "incomplete" : `${formatPercent(r.ratio)} · beats ${100 - (percentileOf(r.ratio, ratios) ?? 0)}% of benchmarks`}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-ink-2">Research summary (2026-10-09): Atlanta internet prices on in-stock gas TRD Off-Road Premium units run from no discount plus $1,100 to $1,200 in fees, up to about 6% off. Prices actually paid nationally cluster at 5% to 8% off sticker; invoice sits near 92% to 93% of MSRP. A realistic Atlanta target is a selling price 6% to 7% below Total SRP, no add-ons, one doc fee, for an all-in of 94.5% to 95.5%. A stretch is 93%. Above 97% is merely fine.</p>
        </Section>
      ) : (
        <Section id="trade-vs" title="Dealer allowances against the market" intro="Each deal's trade allowance next to the researched values. A dealer allowance is worth 7% more than cash because of the TAVT credit.">
          <ul className="text-sm">
            {reports
              .filter((r) => r.allowance !== null)
              .map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 border-t border-line py-2 first:border-t-0">
                  <Link href={`/deals/${r.id}`} className="underline">
                    {r.name}
                  </Link>
                  <span className="num">
                    {formatCents(r.allowance)}
                    {median !== null && ` · ${r.allowance! >= median ? "at or above" : "below"} the market median`}
                  </span>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-sm text-ink-2">Research summary (2026-10-09): a 2022 Model 3 Long Range with 30k to 50k miles in good condition books at about $22,700 to $25,900 trade-in and $24,000 to $27,400 private party in Atlanta. Used Tesla values were firm in September 2026 while off-lease EV supply is building, so get CarMax, Carvana and a KBB instant offer on the same day and use the best as the floor for the dealer.</p>
        </Section>
      )}

      <Section id="add" title="Add a data point">
        <BenchmarkForm />
      </Section>

      <Section id="points" title={`Data points (${rows.length})`} intro={`Marked stale after ${s.settings.benchmarkStaleDays} days.`}>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-2">None yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Observed</th>
                  <th>Kind</th>
                  <th className="text-right">Sticker</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">% of sticker</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const stale = daysBetween(b.observedOn, today) > s.settings.benchmarkStaleDays;
                  return (
                    <tr key={b.id} className="row-hover">
                      <td>
                        {b.url ? (
                          <a href={b.url} className="underline" target="_blank" rel="noreferrer">
                            {b.source}
                          </a>
                        ) : (
                          b.source
                        )}
                        {b.note && <span className="block max-w-md text-xs text-ink-3">{b.note}</span>}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(b.observedOn)}
                        {stale && <span className="ml-2 pill pill-caution pill-plain">stale</span>}
                      </td>
                      <td>{b.kind}</td>
                      <td className="num text-right">{formatCents(b.totalSrpCents)}</td>
                      <td className="num text-right">{formatCents(b.priceCents)}</td>
                      <td className="num text-right">{formatPercent(benchmarkRatios([b])[0] ?? null)}</td>
                      <td className="text-right">
                        <ConfirmForm action={deleteBenchmark.bind(null, b.id)} message="Delete this benchmark?">
                          <button type="submit" className="btn btn-quiet btn-sm text-ink-3">
                            Delete
                          </button>
                        </ConfirmForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
