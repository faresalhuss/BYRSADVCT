import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { anthropicConfigured, extractDocument } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({ attachmentId: z.uuid(), kindHint: z.enum(["sticker", "worksheet", "unknown"]).default("unknown") });

export async function POST(req: NextRequest) {
  if (!anthropicConfigured()) return NextResponse.json({ error: "Import is not configured in this environment." }, { status: 503 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const { data: att } = await supabase.from("attachments").select("storage_path, mime").eq("id", parsed.data.attachmentId).maybeSingle();
  if (!att) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  const { data: blob, error } = await supabase.storage.from("attachments").download(att.storage_path);
  if (error || !blob) return NextResponse.json({ error: error?.message ?? "Could not read the file." }, { status: 500 });
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(att.mime)) {
    return NextResponse.json({ error: "Only PDF, JPEG, PNG and WebP can be read. HEIC files are converted on upload; re-upload if this one was not." }, { status: 415 });
  }
  try {
    const extraction = await extractDocument({ bytes: Buffer.from(await blob.arrayBuffer()), mime: att.mime, kindHint: parsed.data.kindHint });
    return NextResponse.json({ extraction });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
