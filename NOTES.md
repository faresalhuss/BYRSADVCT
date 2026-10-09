# NOTES

One line per lesson. Corrections and confirmed approaches alike. Why each mattered.

- Next 16 renamed middleware to `proxy.ts`; `cacheComponents` is on by default, so any `cookies()` read must sit inside a `<Suspense>` boundary or the build fails.
- create-next-app 16.4 pins TypeScript `^5` (5.9.3), not 7.0.2; Next's type plugin targets TS 5, so the plan's fallback applied from the start.
- Tailwind 4 in Next 16.4 runs through `@tailwindcss/turbopack`, not PostCSS; there is no postcss config to write.
- Supabase server auth: verify identity with `auth.getClaims()` (JWT signature check), never `getSession()`; env names are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Vercel MCP cannot list env vars (403); `vercel env ls` via the CLI works and prints names only.
- `ANTHROPIC_API_KEY` is set for Production only; Preview and Development lack it, so the import option hides there until the owner adds it.
- Golden fixture implied APR reproduces only when principal = dealer balance minus the column's cash down (56,545.91 minus 0 / 2,500 / 5,000).
