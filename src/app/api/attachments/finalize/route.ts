import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIMES } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  dealId: z.uuid(),
  path: z.string().min(1).max(300),
  kind: z.enum(["sticker", "worksheet", "buyers_order", "photo", "other"]),
  mime: z.enum(ATTACHMENT_MIMES),
  bytes: z.number().int().positive().max(ATTACHMENT_MAX_BYTES),
  originalName: z.string().max(200).nullable(),
});

/**
 * Called after the browser uploads the file straight to private storage (Vercel bodies are
 * capped at 4.5 MB, so uploads never pass through here). Converts HEIC to JPEG, builds a
 * thumbnail, and records the attachment row.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const b = parsed.data;
  if (!b.path.startsWith(`deals/${b.dealId}/`)) return NextResponse.json({ error: "Path does not belong to this deal." }, { status: 400 });

  const bucket = supabase.storage.from("attachments");
  const { data: blob, error: dlError } = await bucket.download(b.path);
  if (dlError || !blob) return NextResponse.json({ error: dlError?.message ?? "Upload not found." }, { status: 404 });

  let storagePath = b.path;
  let mime: string = b.mime;
  let bytes = b.bytes;
  let buffer = Buffer.from(await blob.arrayBuffer());

  if (mime === "image/heic" || mime === "image/heif") {
    const { default: heicConvert } = await import("heic-convert");
    const out = await heicConvert({ buffer: new Uint8Array(buffer), format: "JPEG", quality: 0.88 });
    buffer = Buffer.from(out);
    mime = "image/jpeg";
    bytes = buffer.byteLength;
    storagePath = b.path.replace(/\.(heic|heif)$/i, ".jpg");
    const { error: upError } = await bucket.upload(storagePath, buffer, { contentType: mime, upsert: true });
    if (upError) return NextResponse.json({ error: upError.message }, { status: 500 });
    if (storagePath !== b.path) await bucket.remove([b.path]);
  }

  let thumbPath: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  if (mime.startsWith("image/")) {
    try {
      const img = sharp(buffer, { failOn: "none" }).rotate();
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      const thumb = await img.resize({ width: 640, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      thumbPath = storagePath.replace(/\.[a-z0-9]+$/i, "") + ".thumb.webp";
      const { error: tErr } = await bucket.upload(thumbPath, thumb, { contentType: "image/webp", upsert: true });
      if (tErr) thumbPath = null;
    } catch {
      thumbPath = null;
    }
  }

  const sub = typeof claims.claims.sub === "string" ? claims.claims.sub : null;
  const { data: row, error } = await supabase
    .from("attachments")
    .insert({ deal_id: b.dealId, kind: b.kind, storage_path: storagePath, thumb_path: thumbPath, mime, bytes, width, height, original_name: b.originalName, created_by: sub })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attachment: row });
}
