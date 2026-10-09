import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Converts an uploaded HEIC/HEIF under imports/ to JPEG so the import reader can use it. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = z.object({ path: z.string().regex(/^imports\/[^/]+\/[^/]+\.(heic|heif)$/i) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const bucket = supabase.storage.from("attachments");
  const { data: blob, error } = await bucket.download(parsed.data.path);
  if (error || !blob) return NextResponse.json({ error: error?.message ?? "Upload not found." }, { status: 404 });
  const { default: heicConvert } = await import("heic-convert");
  const out = await heicConvert({ buffer: new Uint8Array(await blob.arrayBuffer()), format: "JPEG", quality: 0.88 });
  const jpeg = Buffer.from(out);
  const newPath = parsed.data.path.replace(/\.(heic|heif)$/i, ".jpg");
  const { error: upError } = await bucket.upload(newPath, jpeg, { contentType: "image/jpeg", upsert: true });
  if (upError) return NextResponse.json({ error: upError.message }, { status: 500 });
  await bucket.remove([parsed.data.path]);
  return NextResponse.json({ path: newPath, mime: "image/jpeg", bytes: jpeg.byteLength });
}
