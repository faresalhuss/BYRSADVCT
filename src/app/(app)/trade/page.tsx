import type { Metadata } from "next";
import { Suspense } from "react";
import { deleteOutsideOffer } from "@/db/actions";
import { getSettingsBundle, getTradeBundle } from "@/db/queries";
import { daysBetween, formatCents, divByOnePlusRate } from "@/engine";
import { formatDate, todayIso } from "@/lib/dates";
import { OutsideOfferForm, TradeProfileForm } from "./forms";

export const metadata: Metadata = { title: "Trade" };

export default function TradePage() {
  return (
    <main>
      <h1 className="text-3xl">Trade</h1>
      <p className="mt-1 text-sm text-ink-2">Your payoff, and every outside offer you have in hand. Each deal is measured against the best unexpired one.</p>
      <Suspense fallback={<p className="mt-4 text-ink-2">Loading</p>}>
        <Trade />
      </Suspense>
    </main>
  );
}

async function Trade() {
  const [t, s] = await Promise.all([getTradeBundle(), getSettingsBundle()]);
  const today = todayIso();
  const rate = s.taxRule.rate;
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="card p-4">
        <h2 className="text-lg">Trade vehicle and payoff</h2>
        <TradeProfileForm initial={{ payoffCents: t.profile.payoffCents, payoffGoodThrough: t.profile.payoffGoodThrough, vinAndOwnerRecorded: t.profile.vinAndOwnerRecorded, vehicle: t.vehicle }} />
      </section>
      <section className="card p-4">
        <h2 className="text-lg">Outside offers</h2>
        <OutsideOfferForm />
        {t.outsideOffers.length === 0 ? (
          <p className="mt-4 text-sm text-ink-2">No outside offers yet. Add the CarMax, Carvana or private-party numbers you have.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {t.outsideOffers.map((o) => {
              const expired = o.expiresOn !== null && daysBetween(today, o.expiresOn) < 0;
              return (
                <li key={o.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-line/70 py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {o.source} <span className="num">{formatCents(o.cents)}</span>
                      {expired && <span className="ml-2 pill pill-flag">expired</span>}
                      {o.contingentOnInspection && <span className="ml-2 pill pill-info">pending inspection</span>}
                    </p>
                    <p className="text-ink-2">
                      {o.expiresOn ? `Expires ${formatDate(o.expiresOn)}` : "No expiry"}
                      {!expired && (
                        <>
                          {" "}
                          · break-even dealer allowance <span className="num">{formatCents(divByOnePlusRate(o.cents, rate, s.taxRule.ratePrecision))}</span>
                        </>
                      )}
                      {o.note && ` · ${o.note}`}
                    </p>
                  </div>
                  <form action={deleteOutsideOffer.bind(null, o.id)}>
                    <button type="submit" className="btn btn-quiet btn-sm text-ink-2">
                      Delete
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
