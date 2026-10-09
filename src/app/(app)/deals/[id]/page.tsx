import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmForm } from "@/components/confirm-form";
import { Icon } from "@/components/icons";
import { MapLink } from "@/components/map-link";
import { StatusPill } from "@/components/pills";
import { DealReportView } from "@/components/report/deal-report-view";
import { PageHeader } from "@/components/ui";
import { duplicateDeal, setArchived } from "@/db/actions";
import { evaluate, getDeal, getEvalContext, parseSticker, parseVehicle } from "@/db/queries";
import { formatDate } from "@/lib/dates";

export default function DealPage(props: PageProps<"/deals/[id]">) {
  return (
    <main>
      <Suspense fallback={<div className="skeleton h-64" aria-hidden="true" />}>
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
      <PageHeader
        crumb={{ href: "/", label: "Deals" }}
        title={d.deal.dealership_name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{vehicleText || "Vehicle not entered"}</span>
            {vehicle.vin && <span className="mono text-xs">{vehicle.vin}</span>}
            <StatusPill status={d.deal.status} />
            {report.dealType === "lease" && <span className="pill pill-info pill-plain">lease</span>}
            <span className="text-xs text-ink-3">Revision {d.latest?.revision_no ?? 0}</span>
            {d.deal.quote_expires_on && <span className="text-xs text-ink-3">Expires {formatDate(d.deal.quote_expires_on)}</span>}
            {archived && <span className="pill pill-info pill-plain">archived</span>}
          </span>
        }
        actions={
          <>
            <Link href={`/deals/${id}/edit`} className="btn btn-primary">
              <Icon.Edit size={16} /> Edit
            </Link>
            <Link href={`/deals/${id}/attachments`} className="btn">
              <Icon.File size={16} /> Files
            </Link>
            <Link href={`/deals/${id}/notes`} className="btn">
              Notes
            </Link>
            <a href={`/api/deals/${id}/pdf`} className="btn" title="Dealer-style buyer's order as a PDF">
              <Icon.Download size={16} /> PDF
            </a>
          </>
        }
      />
      <div className="no-print -mt-3 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <MapLink name={d.deal.dealership_name} address={d.deal.dealership_address} />
        {d.deal.dealership_phone && (
          <a href={`tel:${d.deal.dealership_phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-accent">
            <Icon.Phone size={14} /> {d.deal.dealership_phone}
            {d.deal.salesperson && <span className="text-ink-3">· {d.deal.salesperson}</span>}
          </a>
        )}
        {d.deal.dealership_website && (
          <a href={d.deal.dealership_website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-ink-2 underline decoration-dotted underline-offset-4 hover:text-accent">
            <Icon.Arrow size={14} className="rotate-[-45deg]" /> Website
          </a>
        )}
        <span className="flex flex-wrap gap-1 text-ink-2">
          <Link href={`/deals/${id}/revisions`} className="btn btn-quiet btn-sm">
            Revisions ({d.revisions.length})
          </Link>
          <Link href={`/deals/${id}/print`} className="btn btn-quiet btn-sm">
            Print summary
          </Link>
          <Link href={`/compare?ids=${id}`} className="btn btn-quiet btn-sm">
            Compare
          </Link>
          <form action={duplicateDeal.bind(null, id)} className="inline">
            <button type="submit" className="btn btn-quiet btn-sm">
              Duplicate
            </button>
          </form>
          <ConfirmForm action={setArchived.bind(null, id, !archived)} message={archived ? "Unarchive this deal?" : "Archive this deal? It moves to the Archived list."} className="inline">
            <button type="submit" className="btn btn-quiet btn-sm">
              {archived ? "Unarchive" : "Archive"}
            </button>
          </ConfirmForm>
        </span>
      </div>
      <DealReportView report={report} sticker={sticker} vehicle={vehicle} settings={ctx.settingsBundle.settings} dealId={id} salesperson={d.deal.salesperson} dealershipName={d.deal.dealership_name} />
    </>
  );
}
