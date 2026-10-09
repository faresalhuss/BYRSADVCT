import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getAttachments, getDeal, parseOffer, parseSticker, parseVehicle, EMPTY_OFFER } from "@/db/queries";
import { anthropicConfigured } from "@/lib/anthropic";
import { ImportReview } from "./import-review";

export default function ImportPage(props: PageProps<"/deals/[id]/import">) {
  return (
    <main>
      <Suspense fallback={<p className="text-ink-2">Loading</p>}>
        <Import params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Import({ params, searchParams }: { params: PageProps<"/deals/[id]/import">["params"]; searchParams: PageProps<"/deals/[id]/import">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  const attachmentId = typeof sp.attachment === "string" ? sp.attachment : null;
  if (!anthropicConfigured()) redirect(`/deals/${id}/attachments`);
  const [d, attachments] = await Promise.all([getDeal(id), getAttachments(id)]);
  if (!d) notFound();
  const att = attachments.find((a) => a.id === attachmentId) ?? null;
  if (!att) {
    return (
      <>
        <h1 className="text-3xl">Import</h1>
        <p className="mt-2 text-ink-2">
          Pick a sticker or worksheet on the{" "}
          <Link href={`/deals/${id}/attachments`} className="underline">
            attachments page
          </Link>{" "}
          and choose Import.
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-sm">
        <Link href={`/deals/${id}`} className="underline">
          {d.deal.dealership_name}
        </Link>
      </p>
      <h1 className="text-3xl">Import from {att.kind === "sticker" ? "window sticker" : att.kind === "worksheet" ? "worksheet" : "document"}</h1>
      <p className="mt-1 text-sm text-ink-2">Every extracted field is shown beside the source. Nothing is saved until you confirm, and the import is blocked unless the line items reconcile with the printed total.</p>
      <ImportReview dealId={id} attachment={{ id: att.id, mime: att.mime, kind: att.kind, name: att.original_name ?? "document" }} current={{ sticker: parseSticker(d.deal.sticker), vehicle: parseVehicle(d.deal.vehicle), offer: d.latest ? parseOffer(d.latest.offer) : EMPTY_OFFER }} />
    </>
  );
}
