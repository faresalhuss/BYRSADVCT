import Link from "next/link";
import { Suspense } from "react";
import { DealCard } from "@/components/deal-card";
import { Icon } from "@/components/icons";
import { Money, Pct } from "@/components/money";
import { EmptyState, Metric, PageHeader } from "@/components/ui";
import { evaluate, getEvalContext, listDeals, listInquiries } from "@/db/queries";
import { compareOverall } from "@/engine";

export default function DealsPage(props: PageProps<"/">) {
  return (
    <main>
      <PageHeader
        title="Deals"
        description="Every offer pulled apart, audited and ranked on all-in dealer price, trade excluded."
        actions={
          <>
            <Link href="/deals/new?import=1" className="btn">
              <Icon.Upload size={16} /> Import from documents
            </Link>
            <Link href="/deals/new" className="btn btn-primary">
              <Icon.Plus size={16} /> New deal
            </Link>
          </>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <DealsList searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function DealsList({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const [deals, ctx, inquiries] = await Promise.all([listDeals({ archived }), getEvalContext(), listInquiries()]);
  const reports = deals.map((d) => ({ d, report: evaluate(d, ctx) }));
  const complete = reports.filter((r) => r.report.complete && r.report.price.allIn.value !== null).sort((a, b) => a.report.price.allIn.value! - b.report.price.allIn.value!);
  const incomplete = reports.filter((r) => !complete.includes(r));
  const overall = compareOverall(reports.map((r) => r.report));
  const best = complete[0] ?? null;
  const bestOverall = overall.find((o) => o.rank === 1) ?? null;
  const toCall = inquiries.filter((i) => i.status === "to_call").length;
  const openFlags = reports.reduce((s, r) => s + r.report.flags.filter((f) => f.severity === "flag").length, 0);

  return (
    <div className="flex flex-col gap-6">
      {!archived && reports.length > 0 && (
        <div className="rise grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-4">
            <Metric label="Best all-in, trade excluded" hint={best ? best.d.deal.dealership_name : "no complete deal yet"}>
              <Pct value={best?.report.price.allInRatio.value ?? null} label="Best all-in as percent of SRP" />
            </Metric>
          </div>
          <div className="card p-4">
            <Metric label="Best net cost with trade" hint={bestOverall ? `${bestOverall.name}, ${bestOverall.bestRoute === "trade" ? "trade to dealer" : "sell outside"}` : "needs trade figures"}>
              <Money cents={bestOverall?.bestNetCents ?? null} label="Best net cost" showCents={false} />
            </Metric>
          </div>
          <div className="card p-4">
            <Metric label="Open flags across deals" hint={openFlags > 0 ? "money being hidden somewhere" : "nothing flagged"}>
              <span className={openFlags > 0 ? "text-flag" : "text-good"}>{openFlags}</span>
            </Metric>
          </div>
          <Link href="/inquire" className="card card-hover p-4">
            <Metric label="Listings to call" hint="open the Inquire tab">
              {toCall}
            </Metric>
          </Link>
        </div>
      )}

      <div className="flex items-center gap-1 text-sm">
        <Link href="/" className={`tap inline-flex items-center rounded-md px-3 ${archived ? "text-ink-2 hover:text-ink" : "bg-surface-2 font-medium text-ink"}`} aria-current={archived ? undefined : "page"}>
          Active
        </Link>
        <Link href="/?archived=1" className={`tap inline-flex items-center rounded-md px-3 ${archived ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"}`} aria-current={archived ? "page" : undefined}>
          Archived
        </Link>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title={archived ? "No archived deals." : "No deals yet."}
          action={
            !archived && (
              <div className="flex flex-wrap gap-2">
                <Link href="/deals/new?import=1" className="btn btn-primary">
                  <Icon.Upload size={16} /> Import a worksheet or sticker
                </Link>
                <Link href="/deals/new" className="btn">
                  Enter by hand
                </Link>
              </div>
            )
          }
        >
          {!archived && "Photograph the dealer's worksheet and window sticker, or type the numbers in. Everything is audited as you go."}
        </EmptyState>
      ) : (
        <>
          <ol className="rise-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {complete.map(({ d, report }, i) => (
              <li key={d.deal.id}>
                <DealCard deal={d.deal} report={report} rank={i + 1} overall={overall.find((o) => o.dealId === d.deal.id) ?? null} />
              </li>
            ))}
          </ol>
          {incomplete.length > 0 && (
            <section>
              <h2>Incomplete</h2>
              <p className="mb-3 text-sm text-ink-2">Ranked separately until every number is quoted. Unknown is never treated as zero.</p>
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {incomplete.map(({ d, report }) => (
                  <li key={d.deal.id}>
                    <DealCard deal={d.deal} report={report} rank={null} overall={null} />
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-44" />
      ))}
    </div>
  );
}
