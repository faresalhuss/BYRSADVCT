import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowlist";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") ? nextParam : "/";

  const supabase = await createClient();
  let email: string | null = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/login?reason=link-failed`, url.origin));
    email = data.user?.email ?? null;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return NextResponse.redirect(new URL(`/login?reason=link-failed`, url.origin));
    email = data.user?.email ?? null;
  } else {
    return NextResponse.redirect(new URL(`/login`, url.origin));
  }

  if (!isAllowedEmail(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(`/login?reason=not-allowed`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
