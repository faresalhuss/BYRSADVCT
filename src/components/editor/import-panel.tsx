"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { Extraction } from "@/lib/anthropic";
import { ATTACHMENT_MAX_BYTES, extensionFor, sniffMime } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";

export interface ImportedFile {
  path: string;
  name: string;
  mime: string;
  bytes: number;
}

type Phase = { kind: "idle" } | { kind: "uploading"; done: number; total: number } | { kind: "reading" } | { kind: "error"; message: string } | { kind: "done"; count: number };

/**
 * Upload 1 to 5 documents (sticker, worksheet, listing screenshot), read them in one Claude
 * call, and hand the merged extraction to the editor. Nothing is saved until the deal is.
 */
export function ImportPanel({ enabled, batchId, onExtracted, files, onFiles }: { enabled: boolean; batchId: string; onExtracted: (x: Extraction) => void; files: ImportedFile[]; onFiles: (f: ImportedFile[]) => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list).slice(0, 5 - files.length);
    if (picked.length === 0) {
      setPhase({ kind: "error", message: "Five documents is the maximum." });
      return;
    }
    const supabase = createClient();
    const added: ImportedFile[] = [];
    setPhase({ kind: "uploading", done: 0, total: picked.length });
    for (const file of picked) {
      const mime = sniffMime(file);
      if (!mime) {
        setPhase({ kind: "error", message: `${file.name}: unsupported type. Use PDF, JPEG, PNG or HEIC.` });
        return;
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        setPhase({ kind: "error", message: `${file.name}: larger than 25 MB.` });
        return;
      }
      let path = `imports/${batchId}/${crypto.randomUUID()}.${extensionFor(mime)}`;
      let upMime = mime;
      let bytes = file.size;
      if (mime === "image/heic" || mime === "image/heif") {
        // HEIC is converted on the server after a normal upload; reuse the finalize route's converter by sending it as a temporary attachment.
        const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: mime });
        if (error) {
          setPhase({ kind: "error", message: `${file.name}: ${error.message}` });
          return;
        }
        const res = await fetch("/api/import/convert", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) });
        const j = (await res.json().catch(() => ({}))) as { path?: string; mime?: string; bytes?: number; error?: string };
        if (!res.ok || !j.path) {
          setPhase({ kind: "error", message: `${file.name}: ${j.error ?? "could not convert HEIC"}` });
          return;
        }
        path = j.path;
        upMime = j.mime ?? "image/jpeg";
        bytes = j.bytes ?? bytes;
      } else {
        const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: mime });
        if (error) {
          setPhase({ kind: "error", message: `${file.name}: ${error.message}` });
          return;
        }
      }
      added.push({ path, name: file.name, mime: upMime, bytes });
      setPhase({ kind: "uploading", done: added.length, total: picked.length });
    }
    onFiles([...files, ...added]);
    setPhase({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function read() {
    setPhase({ kind: "reading" });
    try {
      const res = await fetch("/api/import/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paths: files.map((f) => f.path) }) });
      const j = (await res.json()) as { extraction?: Extraction; error?: string };
      if (!res.ok || !j.extraction) throw new Error(j.error ?? "Extraction failed");
      onExtracted(j.extraction);
      setPhase({ kind: "done", count: files.length });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Extraction failed" });
    }
  }

  return (
    <section className="card card-accent p-4 sm:p-5" aria-labelledby="import-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="import-h" className="flex items-center gap-2">
            <Icon.Sparkle size={16} className="text-accent" /> Import from documents
          </h2>
          <p className="mt-1 text-sm text-ink-2">Add up to five files: the window sticker, the dealer worksheet, a buyer&apos;s order, a listing screenshot. They are read together and the form below is filled in for you to check. Nothing is saved until you create the deal.</p>
        </div>
        <label className={`btn ${enabled ? "" : "opacity-50"}`}>
          <Icon.Upload size={16} /> Add files
          <input ref={inputRef} type="file" accept="image/*,.heic,.heif,application/pdf" capture="environment" multiple className="sr-only" disabled={!enabled || files.length >= 5 || phase.kind === "uploading" || phase.kind === "reading"} onChange={(e) => void upload(e.target.files)} />
        </label>
      </div>
      {!enabled && <p className="mt-3 text-sm text-caution">Import is unavailable in this environment because no Anthropic API key is configured. Manual entry works as usual.</p>}
      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.path} className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs">
              <Icon.File size={14} className="text-ink-3" />
              <span className="max-w-48 truncate">{f.name}</span>
              <button type="button" className="text-ink-3 hover:text-flag" aria-label={`Remove ${f.name}`} onClick={() => onFiles(files.filter((x) => x.path !== f.path))}>
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={read} disabled={!enabled || files.length === 0 || phase.kind === "uploading" || phase.kind === "reading"}>
          {phase.kind === "reading" ? "Reading documents" : `Read ${files.length || ""} ${files.length === 1 ? "document" : "documents"} and fill the form`}
        </button>
        <span className="text-sm text-ink-2" role="status" aria-live="polite">
          {phase.kind === "uploading" && `Uploading ${phase.done} of ${phase.total}`}
          {phase.kind === "done" && `Filled from ${phase.count} ${phase.count === 1 ? "document" : "documents"}. Check every field before you save.`}
          {phase.kind === "error" && <span className="text-flag">{phase.message}</span>}
        </span>
      </div>
    </section>
  );
}
