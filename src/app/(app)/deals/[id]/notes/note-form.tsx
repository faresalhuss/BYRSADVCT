"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addNote } from "@/db/actions";

function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NoteForm({ dealId, defaultWho }: { dealId: string; defaultWho: string | null }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [who, setWho] = useState(defaultWho ?? "");
  const [channel, setChannel] = useState<"verbal" | "written">("verbal");
  const [occurredAt, setOccurredAt] = useState(localNow);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="card mt-4 flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await addNote({ dealId, occurredAt: new Date(occurredAt).toISOString(), who: who || null, channel, body });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setBody("");
          setOccurredAt(localNow());
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Note</span>
        <textarea className="field min-h-24 py-2" value={body} onChange={(e) => setBody(e.target.value)} required placeholder="What was said" />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Who</span>
          <input className="field" value={who} onChange={(e) => setWho(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Channel</span>
          <select className="field" value={channel} onChange={(e) => setChannel(e.target.value as "verbal" | "written")}>
            <option value="verbal">Verbal</option>
            <option value="written">Written</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">When</span>
          <input type="datetime-local" className="field" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        </label>
      </div>
      {error && (
        <p className="text-sm text-flag" role="alert">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving" : "Add note"}
        </button>
      </div>
    </form>
  );
}
