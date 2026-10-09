"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/allowlist";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" } | { status: "error"; message: string };

const schema = z.object({ email: z.email(), password: z.string().min(1), next: z.string().max(500).optional() });

export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: String(formData.get("next") ?? "/"),
  });
  if (!parsed.success) return { status: "error", message: "Enter your email address and password." };
  const email = parsed.data.email.toLowerCase();
  if (!isAllowedEmail(email)) return { status: "error", message: "That email address is not on the allowlist." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) return { status: "error", message: "Email address or password is not right." };
  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/";
  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type PasswordState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

const passwordSchema = z.object({ password: z.string().min(10, "Use at least 10 characters."), confirm: z.string() }).refine((v) => v.password === v.confirm, { message: "The two entries do not match.", path: ["confirm"] });

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = passwordSchema.safeParse({ password: String(formData.get("password") ?? ""), confirm: String(formData.get("confirm") ?? "") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: error.message };
  return { status: "saved" };
}
