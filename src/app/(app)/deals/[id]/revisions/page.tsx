import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { diffOffers, formatCents, formatApr } from "@/engine";
import { getDeal, parseOffer } from "@/db/queries";
import { formatDateTime } from "@/lib/dates";

export default function RevisionsPage(props: PageProps<"/deals/[id]/revisions">) {
  return (
    <main>
      <Suspense fallback={<p className="text-ink-2">Loading</p>}>
        <Revisions params={props.params} />
      </Suspense>
    </main>
  );
}

async function Revisions({ params }: { params: PageProps<"/deals/[id]/revisions">["params"] }) {
  const { id } = await params;
  const d = await getDeal(id);
  if (!d) notFound();
  const revisions = d.revisions; // newest first
  return (
    <>
      <p className="text-sm">
        <Link href={`/deals/${id}`} className="underline">
          {d.deal.dealership_name}
        </Link>
      </p>
      <h1 className="text-3xl">Revisions</h1>
      <p className="mt-1 text-sm text-ink-2">Every saved offer, diffed line by line against the one before it.</p>
      <ol className="mt-4 flex flex-col gap-4">
        {revisions.map((rev, i) => {
          const prev = revisions[i + 1] ?? null;
          const diff = prev ? diffOffers(parseOffer(prev.offer), parseOffer(rev.offer)) : null;
          const changed = diff?.lines.filter((l) => l.change !== "same") ?? [];
          return (
            <li key={rev.id} className="card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">Revision {rev.revision_no}</h2>
                <span className="text-sm text-ink-2">{formatDateTime(rev.created_at)}</span>
              </div>
              {rev.note && <p className="mt-1 text-sm">{rev.note}</p>}
              {diff ? (
                changed.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-2">No offer changes from revision {prev!.revision_no}.</p>
                ) : (
                  <table className="mt-2 w-full text-sm">
                    <thead className="text-xs uppercase text-ink-2">
                      <tr>
                        <th className="text-left font-medium">Line</th>
                        <th className="text-right font-medium">Rev {prev!.revision_no}</th>
                        <th className="text-right font-medium">Rev {rev.revision_no}</th>
                        <th className="text-right font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changed.map((l) => {
                        const fmt = (v: number | string | null) => (v === null ? "—" : l.unit === "cents" ? formatCents(v as number) : l.unit === "rate" ? formatApr(v as number) : String(v));
                        const delta = l.unit === "cents" && typeof l.before === "number" && typeof l.after === "number" ? l.after - l.before : null;
                        return (
                          <tr key={l.key} className="border-t border-line/70">
                            <td className="py-1 pr-2">
                              {l.label}
                              {l.change !== "changed" && <span className="ml-2 pill pill-info">{l.change}</span>}
                            </td>
                            <td className="num py-1 text-right text-ink-2">{fmt(l.before)}</td>
                            <td className="num py-1 text-right">{fmt(l.after)}</td>
                            <td className={`num py-1 text-right ${delta !== null && delta > 0 ? "text-flag" : delta !== null && delta < 0 ? "text-good" : ""}`}>{delta === null ? "" : formatCents(delta, { signAlways: true })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                <p className="mt-2 text-sm text-ink-2">First revision.</p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
