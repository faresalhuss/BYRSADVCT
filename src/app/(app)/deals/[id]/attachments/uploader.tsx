"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_KINDS, ATTACHMENT_MAX_BYTES, extensionFor, sniffMime, type AttachmentKind } from "@/lib/attachments";

type Status = { state: "idle" } | { state: "uploading"; name: string } | { state: "processing"; name: string } | { state: "error"; message: string } | { state: "done"; name: string };

export function Uploader({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<AttachmentKind>("sticker");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const mime = sniffMime(file);
      if (!mime) {
        setStatus({ state: "error", message: `${file.name}: unsupported type. Use PDF, JPEG, PNG or HEIC.` });
        return;
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        setStatus({ state: "error", message: `${file.name}: larger than 25 MB.` });
        return;
      }
      setStatus({ state: "uploading", name: file.name });
      const path = `deals/${dealId}/${crypto.randomUUID()}.${extensionFor(mime)}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: mime, upsert: false });
      if (error) {
        setStatus({ state: "error", message: `${file.name}: ${error.message}` });
        return;
      }
      setStatus({ state: "processing", name: file.name });
      const res = await fetch("/api/attachments/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dealId, path, kind, mime, bytes: file.size, originalName: file.name }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus({ state: "error", message: `${file.name}: ${j.error ?? "could not finish upload"}` });
        return;
      }
      setStatus({ state: "done", name: file.name });
    }
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="card mt-4 flex flex-wrap items-end gap-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">This file is a</span>
        <select className="field" value={kind} onChange={(e) => setKind(e.target.value as AttachmentKind)}>
          {ATTACHMENT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="btn btn-primary cursor-pointer">
        {status.state === "uploading" || status.state === "processing" ? "Working" : "Add file or photo"}
        <input ref={inputRef} type="file" accept="image/*,.heic,.heif,application/pdf" capture="environment" multiple className="sr-only" disabled={status.state === "uploading" || status.state === "processing"} onChange={(e) => void handleFiles(e.target.files)} />
      </label>
      <p className="text-sm text-ink-2" role="status" aria-live="polite">
        {status.state === "uploading" && `Uploading ${status.name}`}
        {status.state === "processing" && `Processing ${status.name}`}
        {status.state === "done" && `Added ${status.name}`}
        {status.state === "error" && <span className="text-flag">{status.message}</span>}
      </p>
    </div>
  );
}
