import Link from "next/link";
import { Suspense } from "react";
import { DealCard } from "@/components/deal-card";
import { evaluate, getEvalContext, listDeals } from "@/db/queries";

export default function DealsPage(props: PageProps<"/">) {
  return (
    <main>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Deals</h1>
          <p className="mt-1 text-sm text-ink-2">Every offer, pulled apart and ranked.</p>
        </div>
        <Link href="/deals/new" className="btn btn-primary">
          New deal
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <DealsList searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function DealsList({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const [deals, ctx] = await Promise.all([listDeals({ archived }), getEvalContext()]);
  const reports = deals.map((d) => ({ d, report: evaluate(d, ctx) }));
  const complete = reports.filter((r) => r.report.complete && r.report.price.allIn.value !== null).sort((a, b) => a.report.price.allIn.value! - b.report.price.allIn.value!);
  const incomplete = reports.filter((r) => !complete.includes(r));

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-3 text-sm">
        <Link href="/" className={`tap inline-flex items-center ${archived ? "text-ink-2" : "font-medium text-accent"}`} aria-current={archived ? undefined : "page"}>
          Active
        </Link>
        <Link href="/?archived=1" className={`tap inline-flex items-center ${archived ? "font-medium text-accent" : "text-ink-2"}`} aria-current={archived ? "page" : undefined}>
          Archived
        </Link>
      </div>
      {reports.length === 0 ? (
        <div className="card p-6">
          <p className="font-medium">{archived ? "No archived deals." : "No deals yet."}</p>
          {!archived && (
            <p className="mt-1 text-ink-2">
              Create the first one from the dealer&apos;s worksheet and window sticker.{" "}
              <Link href="/deals/new" className="text-accent underline">
                New deal
              </Link>
            </p>
          )}
        </div>
      ) : (
        <>
          <ol className="grid gap-3 sm:grid-cols-2">
            {complete.map(({ d, report }, i) => (
              <li key={d.deal.id}>
                <DealCard deal={d.deal} report={report} rank={i + 1} />
              </li>
            ))}
          </ol>
          {incomplete.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg">Incomplete</h2>
              <p className="mb-3 text-sm text-ink-2">Ranked separately until every number is quoted.</p>
              <ol className="grid gap-3 sm:grid-cols-2">
                {incomplete.map(({ d, report }) => (
                  <li key={d.deal.id}>
                    <DealCard deal={d.deal} report={report} rank={null} />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="card h-36 bg-surface-2/60" />
      ))}
    </div>
  );
}
