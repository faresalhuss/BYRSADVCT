import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DealReportView } from "@/components/report/deal-report-view";
import { StatusPill } from "@/components/pills";
import { ConfirmForm } from "@/components/confirm-form";
import { duplicateDeal, setArchived } from "@/db/actions";
import { evaluate, getDeal, getEvalContext, parseSticker, parseVehicle } from "@/db/queries";
import { formatDate } from "@/lib/dates";

export default function DealPage(props: PageProps<"/deals/[id]">) {
  return (
    <main>
      <Suspense fallback={<p className="text-ink-2">Loading deal</p>}>
        <Deal params={props.params} />
      </Suspense>
    </main>
  );
}

async function Deal({ params }: { params: PageProps<"/deals/[id]">["params"] }) {
  const { id } = await params;
  const [d, ctx] = await Promise.all([getDeal(id), getEvalContext()]);
  if (!d) notFound();
  const report = evaluate(d, ctx);
  const vehicle = parseVehicle(d.deal.vehicle);
  const sticker = parseSticker(d.deal.sticker);
  const vehicleText = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const archived = d.deal.archived_at !== null;

  return (
    <>
      <header className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl">{d.deal.dealership_name}</h1>
            <p className="text-ink-2">
              {vehicleText || "Vehicle not entered"}
              {vehicle.vin && <span className="num"> · {vehicle.vin}</span>}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <StatusPill status={d.deal.status} />
              {d.deal.salesperson && <span>{d.deal.salesperson}</span>}
              {d.deal.quote_expires_on && <span>Expires {formatDate(d.deal.quote_expires_on)}</span>}
              <span>Revision {d.latest?.revision_no ?? 0}</span>
              {archived && <span className="pill pill-info">archived</span>}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Link href={`/deals/${id}/edit`} className="btn btn-primary">
              Edit
            </Link>
            <Link href={`/deals/${id}/attachments`} className="btn">
              Attachments
            </Link>
            <Link href={`/deals/${id}/notes`} className="btn">
              Notes
            </Link>
          </div>
        </div>
        <nav aria-label="Deal pages" className="no-print mt-3 flex flex-wrap gap-2 text-sm">
          <Link href={`/deals/${id}/revisions`} className="tap inline-flex items-center underline">
            Revisions ({d.revisions.length})
          </Link>
          <Link href={`/deals/${id}/print`} className="tap inline-flex items-center underline">
            Printable summary
          </Link>
          <Link href={`/compare?ids=${id}`} className="tap inline-flex items-center underline">
            Compare
          </Link>
          <form action={duplicateDeal.bind(null, id)}>
            <button type="submit" className="tap inline-flex items-center underline">
              Duplicate
            </button>
          </form>
          <ConfirmForm action={setArchived.bind(null, id, !archived)} message={archived ? "Unarchive this deal?" : "Archive this deal? It moves to the Archived list."}>
            <button type="submit" className="tap inline-flex items-center underline">
              {archived ? "Unarchive" : "Archive"}
            </button>
          </ConfirmForm>
        </nav>
      </header>
      <DealReportView report={report} sticker={sticker} vehicle={vehicle} settings={ctx.settingsBundle.settings} dealId={id} salesperson={d.deal.salesperson} dealershipName={d.deal.dealership_name} />
    </>
  );
}
