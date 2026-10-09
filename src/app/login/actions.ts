"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/allowlist";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const schema = z.object({ email: z.email(), next: z.string().max(500).optional() });

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: String(formData.get("email") ?? "").trim(), next: String(formData.get("next") ?? "/") });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  const email = parsed.data.email.toLowerCase();
  if (!isAllowedEmail(email)) return { status: "error", message: "That email address is not on the allowlist." };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent", email };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
