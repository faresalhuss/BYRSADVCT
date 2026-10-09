import { notFound } from "next/navigation";
import { Suspense } from "react";
import { evaluate, getDeal, getEvalContext, parseVehicle } from "@/db/queries";
import { formatApr, formatCents, formatPercent, type Derived } from "@/engine";
import { formatDate } from "@/lib/dates";
import { PrintButton } from "./print-button";

export default function PrintPage(props: PageProps<"/deals/[id]/print">) {
  return (
    <main className="mx-auto max-w-3xl">
      <Suspense fallback={<p className="text-ink-2">Loading</p>}>
        <Summary params={props.params} />
      </Suspense>
    </main>
  );
}

function Line({ d, strong = false }: { d: Derived; strong?: boolean }) {
  const text = d.value === null ? "not yet quoted" : d.unit === "cents" ? formatCents(d.value) : d.unit === "ratio" ? formatPercent(d.value) : d.unit === "rate" ? formatApr(d.value) : String(d.value);
  return (
    <tr className={`border-t border-line/70 ${strong ? "font-medium" : ""}`}>
      <td className="py-1 pr-3">{d.label}</td>
      <td className="num py-1 text-right">{text}</td>
    </tr>
  );
}

async function Summary({ params }: { params: PageProps<"/deals/[id]/print">["params"] }) {
  const { id } = await params;
  const [d, ctx] = await Promise.all([getDeal(id), getEvalContext()]);
  if (!d) notFound();
  const r = evaluate(d, ctx);
  const v = parseVehicle(d.deal.vehicle);
  const flags = r.flags.filter((f) => f.severity !== "info");
  return (
    <article className="text-sm">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <header className="border-b border-line pb-3">
        <h1 className="text-2xl">{d.deal.dealership_name}</h1>
        <p>
          {[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ")}
          {v.vin && <span className="num"> · VIN {v.vin}</span>}
        </p>
        <p className="text-ink-2">
          Revision {d.latest?.revision_no ?? 0} · {d.deal.status}
          {d.deal.quote_expires_on && ` · expires ${formatDate(d.deal.quote_expires_on)}`} · printed {formatDate(ctx.today)}
        </p>
      </header>
      <section className="mt-3">
        <p className="text-lg">{r.verdict.headline}</p>
      </section>
      <div className="mt-3 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-base">Price</h2>
          <table className="w-full">
            <tbody>
              <Line d={r.sticker.totalSrp} />
              <Line d={r.price.sellingPrice} strong />
              <Line d={r.price.discountOffSrp} />
              <Line d={r.price.dealerFees} />
              <Line d={r.price.dealerAddons} />
              <Line d={r.price.allIn} strong />
              <Line d={r.price.allInRatio} strong />
              <Line d={r.tax.computedTax} />
              <Line d={r.price.govFees} />
              <Line d={r.price.otd} strong />
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="text-base">Tax and trade</h2>
          <table className="w-full">
            <tbody>
              <Line d={r.tax.statedTax} />
              <Line d={r.tax.difference} strong />
              <Line d={r.tax.correctedBalance} strong />
              <Line d={r.trade.allowance} />
              <Line d={r.trade.equity} />
              <Line d={r.trade.effectiveValue} />
              <Line d={r.trade.breakEvenAllowance} />
              <Line d={r.trade.margin} strong />
            </tbody>
          </table>
        </section>
      </div>
      {r.financing.grid.length > 0 && (
        <section className="mt-4">
          <h2 className="text-base">Payment grid implied APR</h2>
          <p className="num">{r.financing.grid.map((g) => `${g.termMonths} mo: ${formatApr(g.impliedApr)}`).join(" · ")}</p>
        </section>
      )}
      <section className="mt-4">
        <h2 className="text-base">Flags ({flags.length})</h2>
        {flags.length === 0 ? (
          <p className="text-ink-2">None.</p>
        ) : (
          <ul className="list-disc pl-5">
            {flags.map((f) => (
              <li key={f.id}>
                <span className="font-medium">{f.title}</span>
                {f.impactCents !== null && <span className="num"> ({formatCents(f.impactCents)})</span>}
                <span className="text-ink-2"> {f.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-4">
        <h2 className="text-base">Target</h2>
        <p>
          At {formatPercent(ctx.settingsBundle.settings.thresholds.strongRatio, 1)} of total SRP the all-in target is {formatCents(r.target.targetAllInCents)}; ask for a selling price of {formatCents(r.target.targetSellingPriceCents)} ({formatCents(r.target.gapCents)} below the current offer).
        </p>
      </section>
    </article>
  );
}
