# NOTES

One line per lesson. Corrections and confirmed approaches alike. Why each mattered.

- Next 16 renamed middleware to `proxy.ts`; `cacheComponents` is on by default, so any `cookies()` read must sit inside a `<Suspense>` boundary or the build fails.
- create-next-app 16.4 pins TypeScript `^5` (5.9.3), not 7.0.2; Next's type plugin targets TS 5, so the plan's fallback applied from the start.
- Tailwind 4 in Next 16.4 runs through `@tailwindcss/turbopack`, not PostCSS; there is no postcss config to write.
- Supabase server auth: verify identity with `auth.getClaims()` (JWT signature check), never `getSession()`; env names are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Vercel MCP cannot list env vars (403); `vercel env ls` via the CLI works and prints names only.
- `ANTHROPIC_API_KEY` is set for Production only; Preview and Development lack it, so the import option hides there until the owner adds it.
- Golden fixture implied APR reproduces only when principal = dealer balance minus the column's cash down (56,545.91 minus 0 / 2,500 / 5,000).
- With cacheComponents on, `usePathname()` in a client component must sit under a `<Suspense>` boundary or `next build` fails prerendering every route that renders it; the nav tabs are wrapped with a static fallback.
- Vercel caps request bodies at 4.5 MB, so attachments upload from the browser straight to the private Supabase bucket; a finalize route then converts HEIC, builds the thumbnail and records the row.
- NHTSA vPIC returns an empty Trim for this 4Runner VIN and "55 Series" in Series; Series is not a trim, so it is not compared against the entered trim (avoids a false mismatch flag).
- E2E signs in a dedicated password user by calling supabase-js in Node and letting @supabase/ssr serialize the cookies; the app's own UI stays magic-link only.
