import Link from "next/link";
import type { DealReport, Derived, OfferLine, Settings, Sticker, VehicleEntered } from "@/engine";
import { formatApr, formatCents } from "@/engine";
import { formatDate } from "@/lib/dates";
import { Money, Pct } from "@/components/money";
import { SeverityPill, VerdictPill } from "@/components/pills";
import { SummaryBar } from "@/components/summary-bar";
import { Term } from "@/components/term";
import { Explain, Section } from "@/components/ui";
import { DerivedNumber } from "./derived-number";
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

function Row({ label, d, strong = false, indent = false, term }: { label?: string; d: Derived; strong?: boolean; indent?: boolean; term?: string }) {
  return (
    <tr className={`border-t border-line ${strong ? "font-medium" : ""}`}>
      <th scope="row" className={`py-2.5 pr-3 text-left font-normal ${indent ? "pl-4 text-ink-2" : ""} ${strong ? "font-medium text-ink" : ""}`}>
        {term ? <Term k={term}>{label ?? d.label}</Term> : (label ?? d.label)}
      </th>
      <td className="py-1.5 text-right align-top">
        <DerivedNumber d={d} emphasis={strong} />
      </td>
    </tr>
  );
}

function LineRow({ line }: { line: OfferLine }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-2 pl-4 pr-3 text-left font-normal text-ink-2">
        {line.label}
        {line.category === "dealer_addon" && <span className="ml-2 pill pill-caution pill-plain">negotiable</span>}
        <span className="ml-2 text-xs text-ink-3">({SOURCE_LABEL[line.source] ?? line.source})</span>
        {line.note && <span className="block text-xs text-ink-3">{line.note}</span>}
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
  const L = report.lease;
  return (
    <div className="flex flex-col gap-4">
      <SummaryBar allInRatio={report.price.allInRatio.value} otdCents={report.price.otd.value} openFlags={openFlags.length} />

      <section className={`card p-4 sm:p-5 ${report.verdict.band === "strong" || report.verdict.band === "beats_best" ? "card-accent" : ""}`} aria-labelledby="verdict-h">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictPill band={report.verdict.band} />
          {report.verdict.score !== null && <span className="mono text-xs text-ink-3">score {report.verdict.score}/100</span>}
        </div>
        <h2 id="verdict-h" className="mt-2 text-lg">
          {report.verdict.headline}
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="metric">
            <dt className="eyebrow">
              <Term k="all_in">All-in, % of total SRP</Term>
            </dt>
            <dd className="metric-value">
              <DerivedNumber d={report.price.allInRatio} emphasis />
            </dd>
          </div>
          <div className="metric">
            <dt className="eyebrow">
              <Term k="otd">Out the door</Term>
            </dt>
            <dd className="metric-value">
              <DerivedNumber d={report.price.otd} />
            </dd>
          </div>
          <div className="metric">
            <dt className="eyebrow">Open flags</dt>
            <dd className={`metric-value num ${openFlags.length > 0 ? "text-flag" : "text-good"}`}>{openFlags.length}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <Explain>
            The verdict is driven by all-in dealer price as a percentage of Total SRP (your thresholds: strong at or below <Pct value={settings.thresholds.strongRatio} digits={1} />, beats best at or below <Pct value={settings.thresholds.beatsBestRatio} digits={1} />), minus points for open flags. Trade and financing are judged separately below.
          </Explain>
        </div>
        {report.verdict.drivers.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="tap inline-flex cursor-pointer items-center text-ink-2">What drove the score</summary>
            <p className="mt-1 text-ink-3">
              The score runs 0 to 100. All-in at or below your strong line scores 85 to 100, at your beats-best line 70, at sticker 40, and 5% over sticker 10. Each open flag then takes 5 points (up to 25) and each caution 2 (up to 10).
            </p>
            <ul className="mt-1">
              {report.verdict.drivers.map((d) => (
                <li key={d.label} className="flex justify-between border-t border-line py-1">
                  <span>
                    {d.label}: <span className="num">{d.value}</span>
                  </span>
                  <span className="num">{d.effect > 0 ? `+${d.effect}` : d.effect}</span>
                </li>
              ))}
              <li className="border-t border-line py-1 text-ink-3">
                {settings.thresholds.label}.{" "}
                <Link href="/settings" className="underline">
                  Edit thresholds
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

      <Section id="flags" title={`Flags (${report.flags.length})`} intro="Each flag names the move, what it costs you, and what to say.">
        {report.flags.length === 0 ? (
          <p className="text-sm text-ink-2">Nothing flagged.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {report.flags.map((f) => (
              <li key={f.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <SeverityPill severity={f.severity} />
                <div className="min-w-0">
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-ink-2">{f.detail}</p>
                  {f.impactCents !== null && (
                    <p className="num text-sm">
                      Impact: <Money cents={f.impactCents} signAlways />
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(report.programs.applied.length > 0 || report.programs.missing.length > 0) && (
        <Section id="programs" title="Rebate programs" intro="Money from Toyota or Southeast Toyota Finance, applied after the negotiated price.">
          {report.programs.applied.length > 0 && (
            <table className="w-full text-sm">
              <tbody>
                {report.programs.applied.map((a) => (
                  <tr key={a.program.id} className="border-t border-line first:border-t-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {a.program.label}
                      <span className="block text-xs text-ink-3">
                        {a.program.requiresTfsFinancing ? "Requires SETF financing. " : ""}
                        {a.program.stacksWithSpecialApr ? "Stacks with special APR." : "Not with special APR."}
                      </span>
                    </th>
                    <td className="num py-2 text-right text-good">
                      -<Money cents={a.amountCents} />
                    </td>
                  </tr>
                ))}
                <Row d={report.programs.appliedTotal} strong />
              </tbody>
            </table>
          )}
          {report.programs.missing.length > 0 && (
            <div className="mt-3">
              <Explain tone="caution">
                You qualify for {report.programs.missing.map((p) => p.label).join(" and ")} and this deal does not include it. Ask the dealer to add it, then tick it in the editor.{" "}
                <Link href={`/deals/${dealId}/edit`} className="underline">
                  Open the editor
                </Link>
              </Explain>
            </div>
          )}
        </Section>
      )}

      <Section id="price" title="Price, itemized" intro="Tap any number to see its formula, inputs and where each input came from.">
        <table className="w-full text-sm">
          <tbody>
            <Row d={report.sticker.totalSrp} term="total_srp" />
            <Row d={report.sticker.factoryMsrpPlusDph} indent term="factory_msrp" />
            {report.sticker.reconciles === false && <Row d={report.sticker.discrepancy} indent />}
            <Row d={report.price.sellingPrice} strong term="selling_price" />
            <Row d={report.price.discountOffSrp} indent />
            <Row d={report.price.discountPct} indent />
            <Row d={report.price.vsFactoryMsrpDph} indent />
            <Row d={report.price.dealerFees} term="dealer_fees" />
            {report.price.feeLines.map((l) => (
              <LineRow key={l.id} line={l} />
            ))}
            <Row d={report.price.dealerAddons} term="dealer_addons" />
            {report.price.addonLines.map((l) => (
              <LineRow key={l.id} line={l} />
            ))}
            <Row d={report.price.allIn} strong term="all_in" />
            <Row d={report.price.allInRatio} strong />
            <Row d={report.price.allInNoAddons} indent />
            <Row d={report.price.allInNoAddonsRatio} indent />
            <Row d={report.price.govFees} />
            {report.price.govLines.map((l) => (
              <LineRow key={l.id} line={l} />
            ))}
            <Row label={`${t.rule.name} (computed)`} d={report.tax.computedTax} indent term="tavt" />
            <Row d={report.price.otd} strong term="otd" />
            <Row d={report.price.otdNoAddons} indent />
          </tbody>
        </table>
      </Section>

      <Section
        id="tax"
        title="Tax audit"
        intro={
          <>
            {t.rule.name} at {formatApr(t.rule.rate, 1)}, verified {formatDate(t.rule.verifiedOn)}.{" "}
            <a href={t.rule.sourceUrl} className="underline" target="_blank" rel="noreferrer">
              Source
            </a>
            {t.rule.stale && <span className="ml-2 pill pill-caution">re-verify</span>}
            {!t.rule.rebateRuleVerified && <span className="ml-2 pill pill-info">rebate rule unverified</span>}
          </>
        }
      >
        <Explain>
          Georgia charges a one-time 7% <Term k="tavt">TAVT</Term> on the selling price plus taxable dealer fees, minus your trade allowance and any manufacturer rebate. The most common worksheet error is forgetting the trade. The rows below recompute it and test the dealer&apos;s figure against the usual wrong bases.
        </Explain>
        <table className="mt-3 w-full text-sm">
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
          <div className="mt-3">
            <Explain tone="caution">
              Likely error: {t.likelyError.label.toLowerCase()}. The dealer taxed <Money cents={t.likelyError.baseCents} /> instead of <Money cents={t.taxableBase.value} />.
            </Explain>
          </div>
        )}
        {t.candidates.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="tap inline-flex cursor-pointer items-center text-ink-2">Bases tested against the dealer&apos;s figure</summary>
            <table className="table mt-1">
              <thead>
                <tr>
                  <th>Base</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Tax</th>
                  <th className="text-right">Match</th>
                </tr>
              </thead>
              <tbody>
                {t.candidates.map((c) => (
                  <tr key={c.code} className={c.matches ? "font-medium" : ""}>
                    <td>{c.label}</td>
                    <td className="num text-right">{formatCents(c.baseCents)}</td>
                    <td className="num text-right">{formatCents(c.taxCents)}</td>
                    <td className="text-right">{c.matches ? "yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </Section>

      {report.dealType === "lease" && (
        <Section id="lease" title="Lease" intro="A lease is a purchase in disguise. The agreed value is the price, the money factor is the rate, the residual is set by the lessor.">
          <Explain>
            Monthly payment = depreciation ((<Term k="cap_cost">adjusted cap cost</Term> minus <Term k="residual">residual</Term>) divided by the term) plus the rent charge ((adjusted cap cost plus residual) times the <Term k="money_factor">money factor</Term>). Money factor times 2400 is the equivalent APR.
          </Explain>
          <table className="mt-3 w-full text-sm">
            <tbody>
              <Row d={L.grossCapCost} term="cap_cost" />
              <Row d={L.capReductions} indent />
              <Row d={L.adjustedCapCost} strong />
              <Row d={L.residual} term="residual" />
              <Row d={L.depreciationMonthly} />
              <Row d={L.rentChargeMonthly} />
              <Row d={L.basePayment} strong />
              <Row d={L.effectiveApr} strong term="money_factor" />
              <Row d={L.impliedMoneyFactor} indent />
              <Row d={L.impliedApr} indent />
              <Row d={L.paymentGap} />
              <Row d={L.taxTotal} term="tavt" />
              <Row d={L.monthlyWithTax} />
              <Row d={L.dueAtSigning} />
              <Row d={L.totalCost} strong />
              <Row d={L.costPerMonth} strong />
            </tbody>
          </table>
          <h3 className="mt-5">What is negotiable</h3>
          <ul className="mt-2 divide-y divide-line">
            {L.negotiation.map((n) => (
              <li key={n.key} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <div>
                  <p className="font-medium">{n.label}</p>
                  <p className="num text-sm text-ink-2">{n.valueText}</p>
                </div>
                <div className="text-sm">
                  <span className={`pill pill-plain mr-2 ${n.verdict === "push" ? "pill-flag" : n.verdict === "good" ? "pill-good" : "pill-info"}`}>{n.negotiable === "yes" ? "negotiable" : n.negotiable === "partly" ? "sometimes" : "fixed"}</span>
                  {n.advice}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="trade" title="Trade" intro="Price first, trade second. The trade is worth more to a Georgia dealer than to an outside buyer because it cuts TAVT by 7% of the allowance.">
        {report.trade.allowance.value === null ? (
          <p className="text-sm text-ink-2">No trade allowance on this offer. Price is evaluated without the trade.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <tbody>
                <Row d={report.trade.allowance} term="trade_allowance" />
                <Row d={report.trade.payoff} />
                <Row d={report.trade.equity} strong term="equity" />
                <Row d={report.trade.taxValue} />
                <Row d={report.trade.effectiveValue} strong />
                <Row d={report.trade.routeB} label={report.trade.bestOutsideOffer ? `Best outside offer (${report.trade.bestOutsideOffer.source}${report.trade.bestOutsideOffer.expiresOn ? `, expires ${formatDate(report.trade.bestOutsideOffer.expiresOn)}` : ""})` : "Best outside offer"} term="outside_offer" />
                <Row d={report.trade.breakEvenAllowance} term="break_even" />
                <Row d={report.trade.margin} strong />
                <Row d={report.trade.ifDealerMatches} indent />
              </tbody>
            </table>
            {report.trade.winner && (
              <div className="mt-3">
                <Explain tone={report.trade.winner === "trade" ? "good" : "caution"}>
                  {report.trade.winner === "trade" && (
                    <>
                      Trading to this dealer nets <Money cents={report.trade.margin.value} /> more than the outside offer.
                    </>
                  )}
                  {report.trade.winner === "outside" && (
                    <>
                      The outside offer wins by <Money cents={report.trade.margin.value === null ? null : -report.trade.margin.value} />. Ask for at least <Money cents={report.trade.breakEvenAllowance.value} /> to break even, or sell outside.
                    </>
                  )}
                  {report.trade.winner === "tie" && "Both routes net the same."}
                </Explain>
              </div>
            )}
            <h3 className="mt-5">With trade vs without</h3>
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
      </Section>

      <Section id="fin" title="Financing" intro="Financing third. Every payment grid cell is solved for the APR it implies and checked against your pre-approval and the published promo rate.">
        {report.financing.quotes.length === 0 && report.financing.grid.length === 0 ? (
          <p className="text-sm text-ink-2">No financing quote or payment grid entered yet.</p>
        ) : (
          <>
            {report.financing.quotes.map((q) => (
              <table key={q.id} className="mb-3 w-full text-sm">
                <caption className="pb-1 text-left font-medium">
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
              <div>
                <div className="text-sm">
                  <Term k="payment_grid">Payment grid</Term> audit on <DerivedNumber d={report.financing.gridPrincipal} /> principal
                </div>
                <div className="-mx-4 overflow-x-auto px-4">
                  <table className="table mt-1 min-w-[420px]">
                    <thead>
                      <tr>
                        <th>Term</th>
                        {report.financing.grid[0]!.cells.map((c) => (
                          <th key={c.id} className="num text-right">
                            {formatCents(c.cashDownCents, { cents: false })} down
                          </th>
                        ))}
                        <th className="text-right">Implied APR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.financing.grid.map((row) => (
                        <tr key={row.termMonths}>
                          <th scope="row" className="num text-left font-normal">
                            {row.termMonths} mo
                          </th>
                          {row.cells.map((c) => (
                            <td key={c.id} className="num text-right">
                              {formatCents(c.paymentCents)}
                              <span className="block text-xs text-ink-3">{formatApr(c.impliedApr)}</span>
                            </td>
                          ))}
                          <td className="num text-right font-medium">
                            {formatApr(row.impliedApr)}
                            {row.consistent === false && <span className="ml-1 pill pill-caution pill-plain">disagree</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-ink-3">
                  {settings.preApprovalApr !== null ? `Your pre-approval: ${formatApr(settings.preApprovalApr)}.` : "Enter your pre-approval rate in Settings to compare."}{" "}
                  {settings.promoRates.length > 0 && `Promo: ${settings.promoRates.map((p) => `${p.label} ${formatApr(p.apr)}`).join(", ")}.`}
                </p>
              </div>
            )}
          </>
        )}
      </Section>

      <Section id="target" title="What to ask for" intro="Pick a target all-in percentage; the app turns it into the selling price to request and a message you can send.">
        <TargetBuilder totalSrpCents={sticker.totalSrpCents} sellingPriceCents={report.price.sellingPrice.value} dealerFeesCents={report.price.dealerFees.value} dealerAddonsCents={report.price.dealerAddons.value} defaultRatio={settings.thresholds.strongRatio} beatsBestRatio={settings.thresholds.beatsBestRatio} />
        <Counteroffer dealershipName={dealershipName} salesperson={salesperson} vehicle={vehicle} totalSrpCents={sticker.totalSrpCents} targetRatio={report.target.targetRatio} targetAllInCents={report.target.targetAllInCents} />
      </Section>

      {report.revisionDiff && (
        <Section id="rev" title="Since the previous revision">
          <ul className="text-sm">
            {report.revisionDiff.lines
              .filter((l) => l.change !== "same")
              .map((l) => (
                <li key={l.key} className="flex justify-between border-t border-line py-1.5 first:border-t-0">
                  <span>{l.label}</span>
                  <span className="num">{l.unit === "cents" ? `${formatCents(l.before as number | null)} to ${formatCents(l.after as number | null)}` : `${l.before ?? "not entered"} to ${l.after ?? "not entered"}`}</span>
                </li>
              ))}
          </ul>
          <Link href={`/deals/${dealId}/revisions`} className="mt-2 inline-block text-sm underline">
            All revisions
          </Link>
        </Section>
      )}
    </div>
  );
}
