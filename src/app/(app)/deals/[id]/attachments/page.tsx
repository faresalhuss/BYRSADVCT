import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ConfirmForm } from "@/components/confirm-form";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteAttachment } from "@/db/actions";
import { getAttachments, getDeal } from "@/db/queries";
import { ATTACHMENT_KINDS } from "@/lib/attachments";
import { formatDateTime } from "@/lib/dates";
import { anthropicConfigured } from "@/lib/anthropic";
import { Uploader } from "./uploader";
import { Thumb } from "./viewer";

export default function AttachmentsPage(props: PageProps<"/deals/[id]/attachments">) {
  return (
    <main>
      <Suspense fallback={<div className="skeleton h-40" aria-hidden="true" />}>
        <Attachments params={props.params} />
      </Suspense>
    </main>
  );
}

async function Attachments({ params }: { params: PageProps<"/deals/[id]/attachments">["params"] }) {
  const { id } = await params;
  const [d, rows] = await Promise.all([getDeal(id), getAttachments(id)]);
  if (!d) notFound();
  const importEnabled = anthropicConfigured();
  const kindLabel = (k: string) => ATTACHMENT_KINDS.find((x) => x.value === k)?.label ?? k;
  return (
    <>
      <PageHeader crumb={{ href: `/deals/${id}`, label: d.deal.dealership_name }} title="Attachments" description="Window stickers, worksheets, buyer's orders and photos. PDF, JPEG, PNG or HEIC, up to 25 MB each. Stored privately." />
      <Uploader dealId={id} />
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink-2">Nothing attached yet. Photograph the window sticker and the worksheet first.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((a) => (
            <li key={a.id} className="card flex flex-col overflow-hidden">
              <Thumb id={a.id} mime={a.mime} name={a.original_name ?? kindLabel(a.kind)} />
              <div className="flex flex-1 flex-col gap-1 p-2 text-xs">
                <span className="pill pill-info self-start">{kindLabel(a.kind)}</span>
                <span className="truncate" title={a.original_name ?? undefined}>
                  {a.original_name ?? "file"}
                </span>
                <span className="text-ink-2">
                  {(a.bytes / 1024 / 1024).toFixed(1)} MB · {formatDateTime(a.created_at)}
                </span>
                <div className="mt-auto flex flex-wrap gap-1 pt-1">
                  {importEnabled && (a.kind === "sticker" || a.kind === "worksheet") && (
                    <Link href={`/deals/${id}/import?attachment=${a.id}`} className="btn btn-sm">
                      Import
                    </Link>
                  )}
                  <ConfirmForm action={deleteAttachment.bind(null, a.id, id)} message="Delete this file? This cannot be undone.">
                    <button type="submit" className="btn btn-quiet btn-sm text-ink-2">
                      Delete
                    </button>
                  </ConfirmForm>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!importEnabled && <p className="mt-4 text-xs text-ink-2">Sticker import is unavailable in this environment because no Anthropic API key is configured. Manual entry works as usual.</p>}
    </>
  );
}
