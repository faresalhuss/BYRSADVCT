import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";

export interface E2ECreds {
  url: string;
  key: string;
  email: string;
  password: string;
}

export function e2eCreds(): E2ECreds | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!url || !key || !email || !password) return null;
  return { url, key, email, password };
}

/**
 * Signs in the dedicated E2E user with a password through supabase-js and installs the
 * resulting session cookies, serialized by @supabase/ssr itself, into the browser context.
 * The app's own UI stays magic-link only.
 */
export async function signIn(context: BrowserContext, baseURL: string, creds: E2ECreds): Promise<string> {
  const jar: { name: string; value: string }[] = [];
  const supabase = createServerClient(creds.url, creds.key, {
    cookies: {
      getAll: () => jar,
      setAll: (cookies) => {
        for (const c of cookies) {
          const i = jar.findIndex((j) => j.name === c.name);
          if (i >= 0) jar[i] = { name: c.name, value: c.value };
          else jar.push({ name: c.name, value: c.value });
        }
      },
    },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
  if (error || !data.session) throw new Error(`E2E sign-in failed: ${error?.message ?? "no session"}`);
  await context.addCookies(jar.map((c) => ({ name: c.name, value: c.value, url: baseURL })));
  return data.session.access_token;
}

/** Removes every deal whose dealership name starts with the E2E prefix, using the E2E user's own session (RLS applies). */
export async function cleanup(creds: E2ECreds, accessToken: string, prefix: string): Promise<void> {
  const res = await fetch(`${creds.url}/rest/v1/deals?dealership_name=like.${encodeURIComponent(prefix + "%")}`, {
    method: "DELETE",
    headers: { apikey: creds.key, authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`cleanup failed: ${res.status}`);
}
