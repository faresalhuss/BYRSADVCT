import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Redirects to a short-lived signed URL for the attachment (or its thumbnail). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/attachments/[id]/file">) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const { data } = await supabase.from("attachments").select("storage_path, thumb_path").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const wantThumb = req.nextUrl.searchParams.get("thumb") === "1";
  const path = wantThumb && data.thumb_path ? data.thumb_path : data.storage_path;
  const { data: signed, error } = await supabase.storage.from("attachments").createSignedUrl(path, 600);
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "Could not sign." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "cache-control": "private, max-age=300" } });
}
