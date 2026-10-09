import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmForm } from "@/components/confirm-form";
import { Icon } from "@/components/icons";
import { MapLink } from "@/components/map-link";
import { Money } from "@/components/money";
import { PageHeader, Section } from "@/components/ui";
import { deleteAttachment } from "@/db/actions";
import { convertInquiryToDeal, deleteInquiry, setInquiryStatus } from "@/db/inquiry-actions";
import { getInquiry, getInquiryAttachments, parseVehicle } from "@/db/queries";
import { formatPercent, ratio } from "@/engine";
import { ATTACHMENT_KINDS } from "@/lib/attachments";
import { Uploader } from "@/app/(app)/deals/[id]/attachments/uploader";
import { Thumb } from "@/app/(app)/deals/[id]/attachments/viewer";
import { InquiryEditor } from "../inquiry-form";
import type { InquiryForm } from "@/domain/schemas";

export default function InquiryPage(props: PageProps<"/inquire/[id]">) {
  return (
    <main>
      <Suspense fallback={<div className="skeleton h-40" aria-hidden="true" />}>
        <Inquiry params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Inquiry({ params, searchParams }: { params: PageProps<"/inquire/[id]">["params"]; searchParams: PageProps<"/inquire/[id]">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  const editing = sp.edit === "1";
  const [inq, atts] = await Promise.all([getInquiry(id), getInquiryAttachments(id)]);
  if (!inq) notFound();
  const v = parseVehicle(inq.vehicle);
  const adv = inq.advertised_price_cents === null ? null : Number(inq.advertised_price_cents);
  const msrp = inq.msrp_cents === null ? null : Number(inq.msrp_cents);
  const pct = ratio(adv, msrp);
  const kindLabel = (k: string) => ATTACHMENT_KINDS.find((x) => x.value === k)?.label ?? k;

  if (editing) {
    const initial: InquiryForm = {
      dealershipName: inq.dealership_name,
      addressLine: inq.address_line,
      city: inq.city,
      state: inq.state,
      zip: inq.zip,
      phone: inq.phone,
      website: inq.website,
      listingUrl: inq.listing_url,
      salesperson: inq.salesperson,
      vehicle: v,
      advertisedPriceCents: adv,
      msrpCents: msrp,
      notes: inq.notes,
      status: inq.status as InquiryForm["status"],
    };
    return (
      <>
        <PageHeader crumb={{ href: `/inquire/${id}`, label: inq.dealership_name }} title="Edit listing" />
        <InquiryEditor mode="edit" id={id} initial={initial} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        crumb={{ href: "/inquire", label: "Inquire" }}
        title={inq.dealership_name}
        description={[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || "Vehicle not entered"}
        actions={
          <>
            {inq.status !== "converted" && (
              <ConfirmForm action={convertInquiryToDeal.bind(null, id)} message="Create a deal from this listing? The advertised price becomes the starting selling price and attachments move to the deal.">
                <button type="submit" className="btn btn-primary">
                  <Icon.Convert size={16} /> Convert to deal
                </button>
              </ConfirmForm>
            )}
            {inq.converted_deal_id && (
              <Link href={`/deals/${inq.converted_deal_id}`} className="btn btn-primary">
                Open the deal
              </Link>
            )}
            <Link href={`/inquire/${id}?edit=1`} className="btn">
              <Icon.Edit size={16} /> Edit
            </Link>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Section id="listing" title="Listing">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="eyebrow">Advertised price</dt>
              <dd className="metric-value num">
                <Money cents={adv} label="Advertised price" />
              </dd>
              {pct !== null && <dd className="text-xs text-ink-3">{formatPercent(pct)} of the listed MSRP</dd>}
            </div>
            <div>
              <dt className="eyebrow">Listed MSRP / Total SRP</dt>
              <dd className="metric-value num">
                <Money cents={msrp} label="Listed MSRP" />
              </dd>
            </div>
            <div>
              <dt className="eyebrow">VIN</dt>
              <dd className="mono">{v.vin ?? "not entered"}</dd>
            </div>
            <div>
              <dt className="eyebrow">Stock number</dt>
              <dd className="mono">{v.stockNumber ?? "not entered"}</dd>
            </div>
            <div>
              <dt className="eyebrow">Exterior / interior</dt>
              <dd>{[v.exteriorColor, v.interiorColor].filter(Boolean).join(" / ") || "not entered"}</dd>
            </div>
            <div>
              <dt className="eyebrow">Powertrain</dt>
              <dd>{v.powertrain ?? "not entered"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            <MapLink name={inq.dealership_name} address={inq.address_line} city={inq.city} state={inq.state} zip={inq.zip} />
            {inq.phone && (
              <a href={`tel:${inq.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-accent">
                <Icon.Phone size={14} /> {inq.phone}
                {inq.salesperson && <span className="text-ink-3">· ask for {inq.salesperson}</span>}
              </a>
            )}
            {inq.listing_url && (
              <a href={inq.listing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-ink-2 underline decoration-dotted underline-offset-4 hover:text-accent">
                <Icon.Arrow size={14} className="rotate-[-45deg]" /> Open the listing
              </a>
            )}
            {inq.website && (
              <a href={inq.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-ink-2 underline decoration-dotted underline-offset-4 hover:text-accent">
                <Icon.Arrow size={14} className="rotate-[-45deg]" /> Dealer website
              </a>
            )}
          </div>
          {inq.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-ink-2">{inq.notes}</p>}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            {inq.status === "to_call" && (
              <form action={setInquiryStatus.bind(null, id, "called")}>
                <button type="submit" className="btn btn-sm">
                  Mark as called
                </button>
              </form>
            )}
            {inq.status === "called" && (
              <form action={setInquiryStatus.bind(null, id, "to_call")}>
                <button type="submit" className="btn btn-sm">
                  Back to the call list
                </button>
              </form>
            )}
            {inq.status !== "dismissed" && inq.status !== "converted" && (
              <form action={setInquiryStatus.bind(null, id, "dismissed")}>
                <button type="submit" className="btn btn-sm btn-quiet text-ink-2">
                  Dismiss
                </button>
              </form>
            )}
            <ConfirmForm action={deleteInquiry.bind(null, id)} message="Delete this listing and its attachments?">
              <button type="submit" className="btn btn-sm btn-quiet btn-danger text-ink-2">
                <Icon.Trash size={14} /> Delete
              </button>
            </ConfirmForm>
          </div>
        </Section>

        <Section id="files" title="Window sticker and screenshots" intro="PDF, JPEG, PNG or HEIC. They move to the deal when you convert.">
          <Uploader inquiryId={id} defaultKind="sticker" compact />
          {atts.length === 0 ? (
            <p className="mt-4 text-sm text-ink-3">Nothing attached yet.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {atts.map((a) => (
                <li key={a.id} className="card flex flex-col overflow-hidden">
                  <Thumb id={a.id} mime={a.mime} name={a.original_name ?? kindLabel(a.kind)} />
                  <div className="flex items-center justify-between gap-2 p-2 text-xs">
                    <span className="pill pill-info pill-plain">{kindLabel(a.kind)}</span>
                    <ConfirmForm action={deleteAttachment.bind(null, a.id, `inquire/${id}`)} message="Delete this file?">
                      <button type="submit" className="btn btn-quiet btn-sm text-ink-3">
                        Delete
                      </button>
                    </ConfirmForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
