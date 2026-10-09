import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { anthropicConfigured, extractDocuments } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  /** Storage paths under imports/<batch>/ or deals/<id>/ or inquiries/<id>/, 1 to 5 documents. */
  paths: z.array(z.string().min(1).max(300)).min(1).max(5),
});

/**
 * Reads up to five uploaded documents (stickers, worksheets, listing screenshots) in one
 * Claude call and returns one merged extraction for the deal editor to prefill. Nothing is saved.
 */
export async function POST(req: NextRequest) {
  if (!anthropicConfigured()) return NextResponse.json({ error: "Import is not configured in this environment." }, { status: 503 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send 1 to 5 storage paths." }, { status: 400 });

  const docs: { bytes: Buffer; mime: string; name: string }[] = [];
  for (const path of parsed.data.paths) {
    if (!/^(imports|deals|inquiries)\/[^/]+\/[^/]+$/.test(path)) return NextResponse.json({ error: `Unexpected path: ${path}` }, { status: 400 });
    const { data: blob, error } = await supabase.storage.from("attachments").download(path);
    if (error || !blob) return NextResponse.json({ error: `Could not read ${path}: ${error?.message ?? "not found"}` }, { status: 404 });
    const mime = blob.type || (path.endsWith(".pdf") ? "application/pdf" : path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg");
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mime)) return NextResponse.json({ error: `${path} is ${mime}; only PDF, JPEG, PNG and WebP can be read.` }, { status: 415 });
    docs.push({ bytes: Buffer.from(await blob.arrayBuffer()), mime, name: path.split("/").pop() ?? path });
  }
  try {
    const extraction = await extractDocuments(docs);
    return NextResponse.json({ extraction });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Extraction failed." }, { status: 502 });
  }
}
