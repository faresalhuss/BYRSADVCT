import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Term } from "@/components/term";
import { EmptyState, Explain, PageHeader, Section } from "@/components/ui";
import { evaluate, getEvalContext, listDeals } from "@/db/queries";
import { compareDeals, compareOverall, compareTradeRoutes, formatApr, formatCents, formatPercent, type CompareMode, type CompareRow } from "@/engine";
import { DealPicker } from "./deal-picker";

export const metadata: Metadata = { title: "Compare" };

type View = "purchase" | "trade" | "overall";

export default function ComparePage(props: PageProps<"/compare">) {
  return (
    <main>
      <PageHeader title="Compare" description="The 4Runner deals on price alone, the Tesla's exit routes on their own, and the best combination of the two." />
      <Suspense fallback={<div className="skeleton h-64" aria-hidden="true" />}>
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
  const view: View = sp.view === "trade" ? "trade" : sp.view === "overall" ? "overall" : "purchase";
  const mode: CompareMode = sp.mode === "with_trade" ? "with_trade" : "price_only";
  const idsParam = typeof sp.ids === "string" ? sp.ids : Array.isArray(sp.ids) ? sp.ids.join(",") : "";
  const requested = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const [deals, ctx] = await Promise.all([listDeals(), getEvalContext()]);
  const allReports = deals.map((d) => evaluate(d, ctx));
  const selectedIds = requested.length > 0 ? requested : deals.slice(0, 6).map((d) => d.deal.id);
  const reports = allReports.filter((r) => selectedIds.includes(r.id));
  const q = (v: View, m: CompareMode = mode) => `/compare?view=${v}&mode=${m}${requested.length ? `&ids=${requested.join(",")}` : ""}`;

  const Tabs = (
    <nav className="mb-4 flex gap-1 rounded-md border border-line bg-surface p-1" aria-label="What to compare">
      {(
        [
          ["purchase", "4Runner deals"],
          ["trade", "Tesla routes"],
          ["overall", "Best overall"],
        ] as const
      ).map(([v, label]) => (
        <Link key={v} href={q(v)} aria-current={view === v ? "page" : undefined} className={`tap flex flex-1 items-center justify-center rounded-sm px-3 text-sm font-medium ${view === v ? "bg-surface-3 text-ink" : "text-ink-2 hover:text-ink"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );

  if (view === "trade") {
    const routes = compareTradeRoutes(allReports, ctx.trade.profile, ctx.settingsBundle.taxRule, ctx.today);
    return (
      <>
        {Tabs}
        <Section id="routes" title="Where the Tesla nets the most" intro="Every dealer allowance (plus its 7% tax credit) against every outside offer, independent of which 4Runner you buy.">
          <Explain>
            A dealer allowance reduces Georgia TAVT by 7% of the allowance, so it is worth more than the same cash from an outside buyer. The <Term k="break_even">break-even</Term> allowance is the outside offer divided by 1.07.{" "}
            {ctx.trade.profile.payoffCents !== null ? (
              <>
                After payoff is what is left once the {formatCents(ctx.trade.profile.payoffCents)} loan balance is paid{ctx.trade.profile.payoffGoodThrough ? ` (good through ${ctx.trade.profile.payoffGoodThrough})` : ""}: positive is cash to you, negative is what you would bring to the table.
              </>
            ) : (
              <>
                Enter the loan payoff on the{" "}
                <Link href="/trade" className="underline">
                  Trade page
                </Link>{" "}
                to see what each route leaves after the lender is paid.
              </>
            )}
          </Explain>
          {routes.length === 0 ? (
            <p className="mt-3 text-sm text-ink-2">
              No routes yet. Add outside offers on the{" "}
              <Link href="/trade" className="underline">
                Trade page
              </Link>{" "}
              and trade allowances on your deals.
            </p>
          ) : (
            <div className="-mx-4 mt-3 overflow-x-auto px-4">
              <table className="table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Route</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">Tax credit</th>
                    <th className="text-right">Nets you</th>
                    <th className="text-right">After payoff</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => (
                    <tr key={r.key} className={`row-hover ${r.rank === 1 ? "font-medium" : ""} ${r.expired ? "opacity-60" : ""}`}>
                      <td className="mono">{r.rank === null ? (r.expired ? "expired" : "") : `#${r.rank}`}</td>
                      <td>
                        {r.dealId ? (
                          <Link href={`/deals/${r.dealId}`} className="underline">
                            {r.label}
                          </Link>
                        ) : (
                          r.label
                        )}
                      </td>
                      <td className="num text-right">{formatCents(r.grossCents)}</td>
                      <td className="num text-right">{r.kind === "dealer" ? formatCents(r.taxValueCents) : "none"}</td>
                      <td className={`num text-right ${r.rank === 1 ? "text-good" : ""}`}>
                        {formatCents(r.netCents)}
                        {r.rank === 1 && <Icon.Check size={14} className="ml-1 inline" />}
                      </td>
                      <td className={`num text-right ${r.afterPayoffCents !== null && r.afterPayoffCents < 0 ? "text-flag" : ""}`}>{r.afterPayoffCents === null ? "payoff not entered" : formatCents(r.afterPayoffCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </>
    );
  }

  if (view === "overall") {
    const rows = compareOverall(allReports);
    return (
      <>
        {Tabs}
        <Section id="overall" title="Best overall: each 4Runner deal with its best Tesla route" intro="Net cost = all-in dealer price + government fees + tax, minus what the Tesla brings in on the better route for that deal.">
          {rows.length === 0 ? (
            <EmptyState title="No deals yet." />
          ) : (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Deal</th>
                    <th className="text-right">All-in</th>
                    <th className="text-right">Net, trade to dealer</th>
                    <th className="text-right">Net, sell outside</th>
                    <th>Best route</th>
                    <th className="text-right">Best net cost</th>
                    <th className="text-right">Gap to #1</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.dealId} className={`row-hover ${r.rank === 1 ? "font-medium" : ""}`}>
                      <td className="mono">{r.rank === null ? "incomplete" : `#${r.rank}`}</td>
                      <td>
                        <Link href={`/deals/${r.dealId}`} className="underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="num text-right">{formatCents(r.allInCents)}</td>
                      <td className="num text-right">{formatCents(r.netWithTradeCents)}</td>
                      <td className="num text-right">{formatCents(r.netOutsideCents)}</td>
                      <td>{r.bestRoute === "trade" ? "Trade to this dealer" : r.bestRoute === "outside" ? "Sell outside" : "unknown"}</td>
                      <td className={`num text-right ${r.rank === 1 ? "text-good" : ""}`}>{formatCents(r.bestNetCents)}</td>
                      <td className="num text-right text-ink-2">{r.gapToBestCents === null ? "" : r.gapToBestCents === 0 ? "best" : `+${formatCents(r.gapToBestCents)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/api/export/advisor?scope=both" className="btn btn-sm" download>
              <Icon.Download size={14} /> Export everything for an AI advisor
            </a>
          </div>
        </Section>
      </>
    );
  }

  const canCompare = reports.length >= 2 && reports.length <= 6;
  const result = canCompare ? compareDeals(reports, mode) : null;
  return (
    <>
      {Tabs}
      <DealPicker deals={deals.map((d) => ({ id: d.deal.id, name: d.deal.dealership_name }))} selected={selectedIds} mode={mode} />
      {!canCompare ? (
        <div className="mt-4">
          <EmptyState
            title={deals.length < 2 ? "You need at least two deals to compare." : "Pick two to six deals above."}
            action={
              deals.length < 2 && (
                <Link href="/deals/new" className="btn btn-primary">
                  Add another deal
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          <nav className="mt-4 flex gap-2" aria-label="Comparison mode">
            <Link href={q("purchase", "price_only")} aria-current={mode === "price_only" ? "page" : undefined} className={`btn btn-sm ${mode === "price_only" ? "btn-primary" : ""}`}>
              Price only
            </Link>
            <Link href={q("purchase", "with_trade")} aria-current={mode === "with_trade" ? "page" : undefined} className={`btn btn-sm ${mode === "with_trade" ? "btn-primary" : ""}`}>
              With trade
            </Link>
          </nav>
          <div className="mt-3">
            <Explain>
              {mode === "price_only"
                ? "Price only ranks each dealer on its all-in price (selling price, dealer fees and add-ons) as a share of total SRP, with the trade left out. That is the cleanest way to compare dealers, because a trade allowance can hide a weak price."
                : "With trade ranks each dealer on what you would actually pay after trading the Tesla to that dealer: the all-in price plus tax, minus the allowance and its 7% tax credit. A dealer with a weaker price but a stronger trade offer can move up here."}
            </Explain>
          </div>

          <Section id="ranking" title={mode === "price_only" ? "Ranked on all-in dealer price, trade excluded" : "Ranked on net cost after trading to each dealer"} className="mt-4">
            <ol className="text-sm">
              {result!.ranking
                .slice()
                .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                .map((r) => {
                  const name = result!.names[result!.dealIds.indexOf(r.dealId)];
                  const push = result!.push.find((p) => p.dealId === r.dealId);
                  return (
                    <li key={r.dealId} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line py-2 first:border-t-0">
                      <span>
                        <span className="mono mr-2 text-ink-3">{r.rank === null ? "unranked" : `#${r.rank}`}</span>
                        <Link href={`/deals/${r.dealId}`} className="underline">
                          {name}
                        </Link>
                        {!r.complete && <span className="ml-2 pill pill-info pill-plain">incomplete</span>}
                      </span>
                      <span className="num">
                        {formatCents(r.metricCents)}
                        {push && push.gapCents > 0 && <span className="ml-2 text-flag">push down by {formatCents(push.gapCents)} to tie #1</span>}
                        {r.rank === 1 && <span className="ml-2 pill pill-good">best</span>}
                      </span>
                    </li>
                  );
                })}
            </ol>
          </Section>

          <div className="card mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr className="bg-surface-2">
                    <th scope="col" className="sticky left-0 z-10 border-r border-line bg-surface-2">
                      Line
                    </th>
                    {result!.names.map((n, i) => (
                      <th key={result!.dealIds[i]} scope="col" className="min-w-36 text-right">
                        <Link href={`/deals/${result!.dealIds[i]}`} className="underline">
                          {n}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result!.rows.map((row) => (
                    <tr key={row.key} className="row-hover">
                      <th scope="row" className="sticky left-0 z-10 border-r border-line bg-surface text-left font-normal normal-case tracking-normal text-ink">
                        {row.label}
                      </th>
                      {row.values.map((v, i) => {
                        const best = row.bestIndex === i;
                        return (
                          <td key={i} className={`num text-right ${best ? "bg-good-bg font-medium text-good" : ""} ${v === null ? "text-ink-3" : ""}`}>
                            {cell(row, v)}
                            {best && (
                              <>
                                <span className="ml-1" aria-hidden="true">
                                  &#10003;
                                </span>
                                <span className="sr-only">best in row</span>
                              </>
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
    </>
  );
}
