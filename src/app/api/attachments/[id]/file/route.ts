import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Redirects to a short-lived signed URL for the attachment (or its thumbnail). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/attachments/[id]/file">) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const { data } = await supabase.from("attachments").select("storage_path, thumb_path, mime").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const wantThumb = req.nextUrl.searchParams.get("thumb") === "1";
  let thumbPath = data.thumb_path;
  if (wantThumb && !thumbPath && data.mime === "application/pdf") thumbPath = await backfillPdfThumb(supabase, id, data.storage_path);
  const path = wantThumb && thumbPath ? thumbPath : data.storage_path;
  const { data: signed, error } = await supabase.storage.from("attachments").createSignedUrl(path, 600);
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "Could not sign." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "cache-control": "private, max-age=300" } });
}

/** Older PDF attachments have no thumbnail; render one on first request and remember it. */
async function backfillPdfThumb(supabase: Awaited<ReturnType<typeof createClient>>, id: string, storagePath: string): Promise<string | null> {
  try {
    const bucket = supabase.storage.from("attachments");
    const { data: blob } = await bucket.download(storagePath);
    if (!blob) return null;
    const { renderPdfThumbnail } = await import("@/lib/pdf-thumb");
    const res = await renderPdfThumbnail(Buffer.from(await blob.arrayBuffer()));
    const thumbPath = storagePath.replace(/\.[a-z0-9]+$/i, "") + ".thumb.webp";
    const { error } = await bucket.upload(thumbPath, res.thumb, { contentType: "image/webp", upsert: true });
    if (error) return null;
    await supabase.from("attachments").update({ thumb_path: thumbPath, width: res.width, height: res.height }).eq("id", id);
    return thumbPath;
  } catch (e) {
    console.error("pdf thumbnail backfill failed", e);
    return null;
  }
}
