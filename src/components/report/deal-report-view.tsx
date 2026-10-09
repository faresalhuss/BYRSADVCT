import Link from "next/link";
import type { DealReport, Derived, OfferLine, Settings, Sticker, VehicleEntered } from "@/engine";
import { formatApr, formatCents } from "@/engine";
import { formatDate } from "@/lib/dates";
import { Money, Pct } from "@/components/money";
import { SeverityPill, VerdictPill } from "@/components/pills";
import { DerivedNumber } from "./derived-number";
import { SummaryBar } from "@/components/summary-bar";
import { TargetBuilder } from "./target-builder";
import { Counteroffer } from "./counteroffer";

interface Props {
  report: DealReport;
  sticker: Sticker;
  vehicle: VehicleEntered;
  settings: Settings;
  dealId: string;
  salesperson: string | null;
  dealershipName: string;
}

const SOURCE_LABEL: Record<string, string> = { typed: "typed", sticker: "sticker", worksheet: "worksheet", assumption: "assumed", setting: "setting", computed: "computed" };

function Row({ label, d, strong = false, indent = false }: { label?: string; d: Derived; strong?: boolean; indent?: boolean }) {
  return (
    <tr className={`border-t border-line/70 ${strong ? "font-medium" : ""}`}>
      <th scope="row" className={`py-2 pr-3 text-left font-normal ${indent ? "pl-4 text-ink-2" : ""} ${strong ? "font-medium text-ink" : ""}`}>
        {label ?? d.label}
      </th>
      <td className="py-1 text-right align-top">
        <DerivedNumber d={d} emphasis={strong} />
      </td>
    </tr>
  );
}

function LineRow({ line }: { line: OfferLine }) {
  return (
    <tr className="border-t border-line/70">
      <th scope="row" className="py-2 pl-4 pr-3 text-left font-normal text-ink-2">
        {line.label}
        {line.category === "dealer_addon" && <span className="ml-2 pill pill-caution">negotiable</span>}
        <span className="ml-2 text-xs">({SOURCE_LABEL[line.source] ?? line.source})</span>
        {line.note && <span className="block text-xs">{line.note}</span>}
      </th>
      <td className="num py-2 text-right">
        <Money cents={line.cents} label={line.label} />
      </td>
    </tr>
  );
}

export function DealReportView({ report, sticker, vehicle, settings, dealId, salesperson, dealershipName }: Props) {
  const openFlags = report.flags.filter((f) => f.severity === "flag");
  const t = report.tax;
  return (
    <div className="flex flex-col gap-4">
      <SummaryBar allInRatio={report.price.allInRatio.value} otdCents={report.price.otd.value} openFlags={openFlags.length} />

      {/* Headline */}
      <section className="card p-4" aria-labelledby="verdict-h">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictPill band={report.verdict.band} />
          {report.verdict.score !== null && <span className="num text-sm text-ink-2">Score {report.verdict.score}/100</span>}
        </div>
        <h2 id="verdict-h" className="mt-2 text-xl">
          {report.verdict.headline}
        </h2>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-2">All-in % SRP</dt>
            <dd className="text-2xl">
              <DerivedNumber d={report.price.allInRatio} emphasis />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-2">Out the door</dt>
            <dd className="text-2xl">
              <DerivedNumber d={report.price.otd} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-2">Open flags</dt>
            <dd className={`num text-2xl ${openFlags.length > 0 ? "text-flag" : ""}`}>{openFlags.length}</dd>
          </div>
        </dl>
        {report.verdict.drivers.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="tap inline-flex cursor-pointer items-center text-ink-2">What drove the verdict</summary>
            <ul className="mt-1">
              {report.verdict.drivers.map((d) => (
                <li key={d.label} className="flex justify-between border-t border-line/70 py-1">
                  <span>
                    {d.label}: <span className="num">{d.value}</span>
                  </span>
                  <span className="num">{d.effect > 0 ? `+${d.effect}` : d.effect}</span>
                </li>
              ))}
              <li className="border-t border-line/70 py-1 text-ink-2">
                Thresholds ({settings.thresholds.label}): strong at or below <Pct value={settings.thresholds.strongRatio} digits={1} />, beats best at or below <Pct value={settings.thresholds.beatsBestRatio} digits={1} />.{" "}
                <Link href="/settings" className="underline">
                  Edit
                </Link>
              </li>
            </ul>
          </details>
        )}
        {!report.complete && (
          <p className="mt-3 text-sm text-caution">
            Not yet quoted: {report.missing.join(", ")}.{" "}
            <Link href={`/deals/${dealId}/edit`} className="underline">
              Fill them in
            </Link>
          </p>
        )}
      </section>

      {/* Flags */}
      <section className="card p-4" aria-labelledby="flags-h">
        <h2 id="flags-h" className="text-lg">
          Flags
        </h2>
        {report.flags.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Nothing flagged.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {report.flags.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-sm">
                <SeverityPill severity={f.severity} />
                <div className="min-w-0">
                  <p className="font-medium">{f.title}</p>
                  <p className="text-ink-2">{f.detail}</p>
                  {f.impactCents !== null && (
                    <p className="num">
                      Impact: <Money cents={f.impactCents} signAlways />
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Price breakdown */}
      <section className="card p-4" aria-labelledby="price-h">
        <h2 id="price-h" className="text-lg">
          Price, itemized
        </h2>
        <p className="text-xs text-ink-2">Tap any number to see how it was derived.</p>
        <table className="mt-2 w-full text-sm">
          <tbody>
            <Row d={report.sticker.totalSrp} />
            <Row d={report.sticker.factoryMsrpPlusDph} indent />
            {report.sticker.reconciles === false && <Row d={report.sticker.discrepancy} indent />}
            <Row d={report.price.sellingPrice} strong />
            <Row d={report.price.discountOffSrp} indent />
            <Row d={report.price.discountPct} indent />
            <Row d={report.price.vsFactoryMsrpDph} indent />
            <Row d={report.price.dealerFees} />
            {report.price.feeLines.map((l) => (
              <LineRow key={l.id} line={l} />
            ))}
            <Row d={report.price.dealerAddons} />
            {report.price.addonLines.map((l) => (
              <LineRow key={l.id} line={l} />
            ))}
            <Row d={report.price.allIn} strong />
            <Row d={report.price.allInRatio} strong />
            <Row d={report.price.allInNoAddons} indent />
            <Row d={report.price.allInNoAddonsRatio} indent />
            <Row d={report.price.govFees} />
            {report.price.govLines.map((l) => (
              <LineRow key={l.id} line={l} />
            ))}
            <Row label={`${t.rule.name} (computed)`} d={report.tax.computedTax} indent />
            <Row d={report.price.otd} strong />
            <Row d={report.price.otdNoAddons} indent />
          </tbody>
        </table>
      </section>

      {/* Tax audit */}
      <section className="card p-4" aria-labelledby="tax-h">
        <h2 id="tax-h" className="text-lg">
          Tax audit
        </h2>
        <p className="mt-1 text-xs text-ink-2">
          {t.rule.name} at {formatApr(t.rule.rate, 1)}, verified {formatDate(t.rule.verifiedOn)}.{" "}
          <a href={t.rule.sourceUrl} className="underline" target="_blank" rel="noreferrer">
            Source
          </a>
          {t.rule.stale && <span className="ml-2 pill pill-caution">re-verify</span>}
          {!t.rule.rebateRuleVerified && <span className="ml-2 pill pill-info">rebate rule unverified</span>}
        </p>
        <table className="mt-2 w-full text-sm">
          <tbody>
            <Row d={t.taxableBase} />
            <Row d={t.computedTax} strong />
            <Row d={t.statedTax} />
            <Row d={t.difference} strong />
            <Row d={t.computedTaxNoAddons} indent />
            <Row d={t.correctedTotal} />
            <Row d={t.correctedBalance} strong />
            <Row d={t.correctedBalanceNoAddons} indent />
          </tbody>
        </table>
        {t.likelyError && (
          <p className="mt-3 rounded-sm bg-flag-bg px-3 py-2 text-sm text-flag">
            Likely error: {t.likelyError.label.toLowerCase()}. The dealer taxed <Money cents={t.likelyError.baseCents} /> instead of <Money cents={t.taxableBase.value} />.
          </p>
        )}
        {t.candidates.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="tap inline-flex cursor-pointer items-center text-ink-2">Bases tested against the dealer&apos;s figure</summary>
            <table className="mt-1 w-full">
              <thead className="text-xs uppercase text-ink-2">
                <tr>
                  <th className="text-left font-medium">Base</th>
                  <th className="text-right font-medium">Amount</th>
                  <th className="text-right font-medium">Tax</th>
                  <th className="text-right font-medium">Match</th>
                </tr>
              </thead>
              <tbody>
                {t.candidates.map((c) => (
                  <tr key={c.code} className={`border-t border-line/70 ${c.matches ? "font-medium" : ""}`}>
                    <td className="py-1 pr-2">{c.label}</td>
                    <td className="num py-1 text-right">{formatCents(c.baseCents)}</td>
                    <td className="num py-1 text-right">{formatCents(c.taxCents)}</td>
                    <td className="py-1 text-right">{c.matches ? "yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      {/* Trade */}
      <section className="card p-4" aria-labelledby="trade-h">
        <h2 id="trade-h" className="text-lg">
          Trade
        </h2>
        {report.trade.allowance.value === null ? (
          <p className="mt-2 text-sm text-ink-2">No trade allowance on this offer. Price is evaluated without the trade.</p>
        ) : (
          <>
            <table className="mt-2 w-full text-sm">
              <tbody>
                <Row d={report.trade.allowance} />
                <Row d={report.trade.payoff} />
                <Row d={report.trade.equity} strong />
                <Row d={report.trade.taxValue} />
                <Row d={report.trade.effectiveValue} strong />
                <Row d={report.trade.routeB} label={report.trade.bestOutsideOffer ? `Best outside offer (${report.trade.bestOutsideOffer.source}${report.trade.bestOutsideOffer.expiresOn ? `, expires ${formatDate(report.trade.bestOutsideOffer.expiresOn)}` : ""})` : "Best outside offer"} />
                <Row d={report.trade.breakEvenAllowance} />
                <Row d={report.trade.margin} strong />
                <Row d={report.trade.ifDealerMatches} indent />
              </tbody>
            </table>
            {report.trade.winner && (
              <p className="mt-3 text-sm">
                {report.trade.winner === "trade" && (
                  <>
                    Trading to this dealer nets <Money cents={report.trade.margin.value} /> more than the outside offer.
                  </>
                )}
                {report.trade.winner === "outside" && (
                  <>
                    The outside offer wins by <Money cents={report.trade.margin.value === null ? null : -report.trade.margin.value} />. Ask for at least <Money cents={report.trade.breakEvenAllowance.value} /> to break even.
                  </>
                )}
                {report.trade.winner === "tie" && "Both routes net the same."}
              </p>
            )}
            <h3 className="mt-4 text-sm font-medium">With trade vs without</h3>
            <table className="mt-1 w-full text-sm">
              <tbody>
                <Row d={report.trade.netCostWithTrade} label="A: trade to this dealer, net cost" strong={report.trade.winner === "trade"} />
                <Row d={report.trade.netCostOutside} label="B: sell to best outside offer, net cost" strong={report.trade.winner === "outside"} />
              </tbody>
            </table>
            {report.trade.bestOutsideOffer === null && (
              <p className="mt-2 text-sm text-ink-2">
                Add an outside offer on the{" "}
                <Link href="/trade" className="underline">
                  Trade page
                </Link>{" "}
                to compare routes.
              </p>
            )}
          </>
        )}
      </section>

      {/* Financing */}
      <section className="card p-4" aria-labelledby="fin-h">
        <h2 id="fin-h" className="text-lg">
          Financing
        </h2>
        {report.financing.quotes.length === 0 && report.financing.grid.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">No financing quote or payment grid entered. Negotiate price first, then financing.</p>
        ) : (
          <>
            {report.financing.quotes.map((q) => (
              <table key={q.id} className="mt-2 w-full text-sm">
                <caption className="text-left font-medium">
                  {q.lender ?? "Lender"}: {formatApr(q.apr)} for {q.termMonths ?? "?"} months
                </caption>
                <tbody>
                  <Row d={q.principal} />
                  <Row d={q.computedPayment} />
                  <Row d={q.quotedPayment} />
                  <Row d={q.gap} strong />
                  <Row d={q.hiddenPrincipal} indent />
                  <Row d={q.totalInterest} />
                </tbody>
              </table>
            ))}
            {report.financing.grid.length > 0 && (
              <div className="mt-3">
                <div className="text-sm">
                  Payment grid audit on <DerivedNumber d={report.financing.gridPrincipal} /> principal
                </div>
                <div className="-mx-4 overflow-x-auto px-4">
                  <table className="mt-1 min-w-[420px] text-sm">
                    <thead className="text-xs uppercase text-ink-2">
                      <tr>
                        <th className="pr-2 text-left font-medium">Term</th>
                        {report.financing.grid[0]!.cells.map((c) => (
                          <th key={c.id} className="num px-2 text-right font-medium">
                            {formatCents(c.cashDownCents, { cents: false })} down
                          </th>
                        ))}
                        <th className="pl-2 text-right font-medium">Implied APR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.financing.grid.map((row) => (
                        <tr key={row.termMonths} className="border-t border-line/70">
                          <th scope="row" className="num py-1 pr-2 text-left font-normal">
                            {row.termMonths} mo
                          </th>
                          {row.cells.map((c) => (
                            <td key={c.id} className="num px-2 py-1 text-right">
                              {formatCents(c.paymentCents)}
                              <span className="block text-xs text-ink-2">{formatApr(c.impliedApr)}</span>
                            </td>
                          ))}
                          <td className="num py-1 pl-2 text-right font-medium">
                            {formatApr(row.impliedApr)}
                            {row.consistent === false && <span className="ml-1 pill pill-caution">disagree</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-ink-2">
                  {settings.preApprovalApr !== null ? `Your pre-approval: ${formatApr(settings.preApprovalApr)}.` : "Enter your pre-approval rate in Settings to compare."}{" "}
                  {settings.promoRates.length > 0 && `Promo rates: ${settings.promoRates.map((p) => `${p.label} ${formatApr(p.apr)}`).join(", ")}.`}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Target and counteroffer */}
      <section className="card p-4" aria-labelledby="target-h">
        <h2 id="target-h" className="text-lg">
          What to ask for
        </h2>
        <TargetBuilder totalSrpCents={sticker.totalSrpCents} sellingPriceCents={report.price.sellingPrice.value} dealerFeesCents={report.price.dealerFees.value} dealerAddonsCents={report.price.dealerAddons.value} defaultRatio={settings.thresholds.strongRatio} beatsBestRatio={settings.thresholds.beatsBestRatio} />
        <Counteroffer dealershipName={dealershipName} salesperson={salesperson} vehicle={vehicle} totalSrpCents={sticker.totalSrpCents} targetRatio={report.target.targetRatio} targetAllInCents={report.target.targetAllInCents} />
      </section>

      {report.revisionDiff && (
        <section className="card p-4" aria-labelledby="rev-h">
          <h2 id="rev-h" className="text-lg">
            Since the previous revision
          </h2>
          <ul className="mt-2 text-sm">
            {report.revisionDiff.lines
              .filter((l) => l.change !== "same")
              .map((l) => (
                <li key={l.key} className="flex justify-between border-t border-line/70 py-1">
                  <span>{l.label}</span>
                  <span className="num">
                    {l.unit === "cents" ? `${formatCents(l.before as number | null)} to ${formatCents(l.after as number | null)}` : `${l.before ?? "not entered"} to ${l.after ?? "not entered"}`}
                  </span>
                </li>
              ))}
          </ul>
          <Link href={`/deals/${dealId}/revisions`} className="mt-2 inline-block text-sm underline">
            All revisions
          </Link>
        </section>
      )}
    </div>
  );
}
