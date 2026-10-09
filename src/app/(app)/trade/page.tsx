import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmForm } from "@/components/confirm-form";
import { Money } from "@/components/money";
import { Term } from "@/components/term";
import { Explain, PageHeader, Section } from "@/components/ui";
import { deleteOutsideOffer } from "@/db/actions";
import { evaluate, getEvalContext, getSettingsBundle, getTradeBundle, listDeals } from "@/db/queries";
import { compareTradeRoutes, daysBetween, divByOnePlusRate, formatCents, tradeCreditApplies } from "@/engine";
import { formatDate, todayIso } from "@/lib/dates";
import { OutsideOfferForm, OutsideOfferItem, TradeProfileForm } from "./forms";

export const metadata: Metadata = { title: "Trade" };

export default function TradePage() {
  return (
    <main>
      <PageHeader title="Trade" description="The Tesla: payoff, every outside offer in hand, and how each dealer's allowance stacks up against them after the tax credit." />
      <Suspense fallback={<div className="skeleton h-64" aria-hidden="true" />}>
        <Trade />
      </Suspense>
    </main>
  );
}

async function Trade() {
  const [t, s, deals, ctx] = await Promise.all([getTradeBundle(), getSettingsBundle(), listDeals(), getEvalContext()]);
  const today = todayIso();
  const rate = s.taxRule.rate;
  const applies = tradeCreditApplies(s.taxRule, t.profile);
  const reports = deals.map((d) => evaluate(d, ctx));
  const routes = compareTradeRoutes(reports, t.profile, s.taxRule, today);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section id="routes" title="Every way to dispose of the Tesla, ranked" intro="Dealer allowances count their tax credit; outside offers do not get one." className="lg:col-span-2">
        {routes.length === 0 ? (
          <p className="text-sm text-ink-2">Add outside offers below and trade allowances on your deals to rank the routes.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="table min-w-[560px]">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Route</th>
                  <th className="text-right">Allowance or offer</th>
                  <th className="text-right">Tax credit</th>
                  <th className="text-right">Nets you</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.key} className={`row-hover ${r.rank === 1 ? "font-medium" : ""}`}>
                    <td className="mono">{r.rank === null ? "" : `#${r.rank}`}</td>
                    <td>{r.label}</td>
                    <td className="num text-right">{formatCents(r.grossCents)}</td>
                    <td className="num text-right">{r.kind === "dealer" ? formatCents(r.taxValueCents) : "none"}</td>
                    <td className={`num text-right ${r.rank === 1 ? "text-good" : ""}`}>{formatCents(r.netCents)}</td>
                    <td className="text-xs text-ink-3">
                      {r.expired && <span className="pill pill-flag pill-plain">expired</span>}
                      {!r.expired && r.expiresOn && `expires ${formatDate(r.expiresOn)}`}
                      {r.contingent && <span className="ml-2 pill pill-info pill-plain">inspection</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="profile" title="Trade vehicle and payoff">
        <Explain>
          <Term k="equity">Equity</Term> is allowance minus payoff. Get a payoff letter with a good-through date; a statement balance is not a payoff.
        </Explain>
        <TradeProfileForm initial={{ payoffCents: t.profile.payoffCents, payoffGoodThrough: t.profile.payoffGoodThrough, vinAndOwnerRecorded: t.profile.vinAndOwnerRecorded, vehicle: t.vehicle }} />
      </Section>

      <Section id="offers" title="Outside offers" intro="CarMax, Carvana, Tesla trade-in, private buyers. Each one sets the floor for the dealer's allowance.">
        <OutsideOfferForm />
        {t.outsideOffers.length === 0 ? (
          <p className="mt-4 text-sm text-ink-2">No outside offers yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col">
            {t.outsideOffers.map((o) => {
              const expired = o.expiresOn !== null && daysBetween(today, o.expiresOn) < 0;
              return (
                <OutsideOfferItem key={o.id} offer={{ id: o.id, source: o.source, cents: o.cents, expiresOn: o.expiresOn ?? "", contingentOnInspection: o.contingentOnInspection, note: o.note ?? "" }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {o.source} <Money cents={o.cents} className="ml-1" />
                      {expired && <span className="ml-2 pill pill-flag pill-plain">expired</span>}
                      {o.contingentOnInspection && <span className="ml-2 pill pill-info pill-plain">pending inspection</span>}
                    </p>
                    <p className="text-ink-2">
                      {o.expiresOn ? `Expires ${formatDate(o.expiresOn)}` : "No expiry"}
                      {!expired && (
                        <>
                          {" "}
                          · <Term k="break_even">break-even allowance</Term> <span className="num">{formatCents(applies ? divByOnePlusRate(o.cents, rate, s.taxRule.ratePrecision) : o.cents)}</span>
                        </>
                      )}
                      {o.note && ` · ${o.note}`}
                    </p>
                    <ConfirmForm action={deleteOutsideOffer.bind(null, o.id)} message="Delete this outside offer?" className="mt-1">
                      <button type="submit" className="text-xs text-ink-3 underline hover:text-flag">
                        Delete
                      </button>
                    </ConfirmForm>
                  </div>
                </OutsideOfferItem>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
