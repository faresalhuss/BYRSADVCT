import Link from "next/link";
import { ConfirmForm } from "@/components/confirm-form";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteNote } from "@/db/actions";
import { getDeal, getNotes } from "@/db/queries";
import { formatDateTime } from "@/lib/dates";
import { NoteForm } from "./note-form";

export default function NotesPage(props: PageProps<"/deals/[id]/notes">) {
  return (
    <main>
      <Suspense fallback={<p className="text-ink-2">Loading</p>}>
        <Notes params={props.params} />
      </Suspense>
    </main>
  );
}

async function Notes({ params }: { params: PageProps<"/deals/[id]/notes">["params"] }) {
  const { id } = await params;
  const [d, notes] = await Promise.all([getDeal(id), getNotes(id)]);
  if (!d) notFound();
  return (
    <>
      <p className="text-sm">
        <Link href={`/deals/${id}`} className="underline">
          {d.deal.dealership_name}
        </Link>
      </p>
      <h1 className="text-3xl">Notes</h1>
      <p className="mt-1 text-sm text-ink-2">What was said, by whom, and whether it was verbal or in writing.</p>
      <NoteForm dealId={id} defaultWho={d.deal.salesperson} />
      {notes.length === 0 ? (
        <p className="mt-6 text-sm text-ink-2">No notes yet. Log the first conversation above.</p>
      ) : (
        <ol className="mt-6 flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
                <span>
                  {formatDateTime(n.occurred_at)}
                  {n.who && <span> · {n.who}</span>}
                </span>
                <span className={`pill ${n.channel === "written" ? "pill-accent" : "pill-info"}`}>{n.channel}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{n.body}</p>
              <ConfirmForm action={deleteNote.bind(null, n.id, id)} message="Delete this note?" className="mt-2 text-right">
                <button type="submit" className="btn btn-quiet btn-sm text-ink-2">
                  Delete
                </button>
              </ConfirmForm>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
