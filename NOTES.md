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
- Owner chose email + password over magic link (no Supabase redirect-URL setup for a personal tool). Accounts were created by SQL with confirmed emails; initial passwords live in the gitignored `.credentials.local`; Settings has a change-password form that needs no email.
- Engine review caught a false-positive "no trade credit" flag on correctly taxed no-trade deals: a wrong-base candidate that equals the correct base is not an error. Candidates with the correct base are now dropped and a matching correct base clears the audit.
- Several null-to-zero leaks (taxable base skipping unknown fees, partial stated tax, grid principal, unknown cash down) were fixed; "unknown is not zero" now also means a quote with no dealer-fee or government-fee line is incomplete.
- UI review: aria-label on a plain span is ignored by screen readers; numbers now carry a visually hidden prefix instead. Closed derivation drawers use `inert` so they leave the accessibility tree. Field borders use a 3:1 `--line-strong` token.
- Lighthouse (simulated slow 4G, 4x CPU) on the local build gave LCP 3.5 s because the deals list waits on Supabase from a laptop in Atlanta to us-east-1; the deployed app runs next to the database and is measured separately.
- Verifying on the deployed app caught a false "sticker does not sum" flag when a total SRP is entered before any sticker lines; an empty line list is "not yet entered", not a sum of zero.
- Playwright's extraHTTPHeaders (used for the Vercel bypass) also attaches to the app's own RSC prefetches and makes WebKit log access-control errors; set the bypass cookie once through the query parameters instead when checking for console errors.
