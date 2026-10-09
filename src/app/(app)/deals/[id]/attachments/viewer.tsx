"use client";

import { useEffect, useRef, useState } from "react";

export function Thumb({ id, mime, name }: { id: string; mime: string; name: string }) {
  const [open, setOpen] = useState(false);
  const isImage = mime.startsWith("image/");
  return (
    <>
      <button type="button" className="relative block aspect-[4/3] w-full bg-surface-2" onClick={() => setOpen(true)} aria-label={`Open ${name}`}>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL via redirect; next/image cannot optimize it
          <img src={`/api/attachments/${id}/file?thumb=1`} alt={name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-ink-2">PDF</span>
        )}
      </button>
      {open && <Viewer id={id} mime={mime} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Full-screen viewer with pinch-zoom (two pointers), wheel zoom and drag to pan. */
export function Viewer({ id, mime, name, onClose }: { id: string; mime: string; name: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ dist: number; scale: number; x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isImage = mime.startsWith("image/");
  const src = `/api/attachments/${id}/file`;

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      last.current = { dist: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y), scale, x: tx, y: ty };
    } else if (pts.length === 1) {
      last.current = { dist: 0, scale, x: e.clientX - tx, y: e.clientY - ty };
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && last.current && last.current.dist > 0) {
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      setScale(Math.min(8, Math.max(1, (last.current.scale * dist) / last.current.dist)));
    } else if (pts.length === 1 && last.current && last.current.dist === 0) {
      setTx(e.clientX - last.current.x);
      setTy(e.clientY - last.current.y);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) last.current = null;
  }

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={name} tabIndex={-1} className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white outline-none">
      <div className="flex items-center justify-between gap-2 p-2">
        <span className="truncate text-sm">{name}</span>
        <div className="flex gap-1">
          {isImage && (
            <>
              <button type="button" className="tap rounded-sm border border-white/30 px-3" onClick={() => setScale((s) => Math.max(1, s / 1.5))} aria-label="Zoom out">
                -
              </button>
              <button type="button" className="tap rounded-sm border border-white/30 px-3" onClick={() => setScale((s) => Math.min(8, s * 1.5))} aria-label="Zoom in">
                +
              </button>
              <button
                type="button"
                className="tap rounded-sm border border-white/30 px-3 text-sm"
                onClick={() => {
                  setScale(1);
                  setTx(0);
                  setTy(0);
                }}
              >
                Reset
              </button>
            </>
          )}
          <a href={src} className="tap inline-flex items-center rounded-sm border border-white/30 px-3 text-sm" target="_blank" rel="noreferrer">
            Open
          </a>
          <button type="button" className="tap rounded-sm border border-white/30 px-3 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div
        className="flex flex-1 touch-none items-center justify-center overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => setScale((s) => Math.min(8, Math.max(1, s * (e.deltaY < 0 ? 1.1 : 0.9))))}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL via redirect
          <img src={src} alt={name} draggable={false} className="max-h-full max-w-full select-none" style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: "none" }} />
        ) : (
          <iframe src={src} title={name} className="h-full w-full bg-white" />
        )}
      </div>
    </div>
  );
}
