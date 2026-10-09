# BYRSADVCT plan

Date: 2026-10-09. Status: awaiting approval.

## What I found before planning

- The project folder was empty. There is no `fixtures/source` directory anywhere under the parent folder. The golden tests will use the values transcribed in the brief. Attachment and sticker-import tests will use images I synthesize, until the real sticker and worksheet scans are dropped into `fixtures/source`.
- Every expected value in the golden fixtures reproduces with integer-cent math and half-up rounding (sticker sum, 5.85% discount, 96.01% and 95.69% all-in, the 1,505.00 TAVT overcharge, 55,040.91 and 54,826.91 balances, 7,500.00 equity, 495.00 and 1,645.00 trade deltas, 21,962.62 break-even, implied APRs 9.196 / 9.147 / 8.115, payment 1,262.38). No expected value needs to change.
- Vercel: the CLI is logged in as `faresalhuss` on team `clicksclients`. I linked the folder; `.vercel/project.json` reads `prj_AbVuPRE3MUwfIG1pdEGHVn6TcKVe` / `team_oazBWPFOToHp3sRet68SFffM` / `project-6cbo3`. Framework is unset (I will set Next.js). Deployment protection is SSO for all deployments except custom domains.
- `vercel env ls` shows `ANTHROPIC_API_KEY` exists for **Production only**. Preview and Development do not have it. Per the brief I will not create a key. Until you add it to those environments, the import option will be hidden there and manual entry works.
- Supabase: the new project `BYRSADVCT` (`azhupaeigrjjgbaocfmf`, us-east-1, Postgres 17) is reachable through the connector. I have the URL and publishable key. I will apply migrations through the connector and never commit keys.
- Latest stable versions on npm today: Next 16.4.0, React 19.3.0, Tailwind 4.3.3, TypeScript 7.0.2, Zod 4.6.5, Vitest 5.0.3, fast-check 4.10.2, Playwright 1.64.0, supabase-js 2.117.3, @supabase/ssr 0.12.7, @anthropic-ai/sdk 0.132.1, ESLint 10.12.0.
- Claude model for sticker import: `claude-opus-5-5` (current default Opus per Anthropic's docs), called with structured outputs (`output_config.format`) so the response is schema-valid JSON, server-side only.

## Architecture

```
src/
  engine/            pure TypeScript, no React, no I/O. Money = integer cents.
    money.ts         parse ("$58,714.00", "58.7k"), format, round half-up
    vin.ts           check digit
    sticker.ts       reconciliation
    price.ts         discount, all-in, OTD, ratio to SRP
    tax.ts           versioned state rules, base construction, audit of wrong bases
    trade.ts         equity, tax value, break-even, route comparison
    finance.ts       amortized payment, implied APR (bisection to 0.001%), grid audit, payment gap
    revisions.ts     line-by-line diff
    flags.ts         every flag in the brief
    verdict.ts       transparent score with driving inputs, thresholds from settings
    target.ts        selling price for a target all-in percentage
    evaluate.ts      one entry point: DealInput -> DealReport (every number carries a derivation tree)
  domain/            Zod schemas shared by engine, DB rows, forms, imports, external APIs
  db/                Supabase clients (server, browser), typed queries
  app/               Next.js App Router routes (below)
  components/        UI, renders DealReport; never computes money
  lib/               nhtsa.ts, anthropic.ts (server only), storage.ts, csv.ts
supabase/migrations  SQL, RLS on every table
tests/engine         vitest + fast-check, golden fixtures in tests/fixtures/*.json
tests/e2e            Playwright: iPhone 15, Pixel 7, desktop
```

Every number in a `DealReport` is a `Derived` value: `{ cents, formula, inputs: [{label, cents|rate, source}] }`. The UI's "tap to see how" renders that tree. Sources are `typed | sticker | worksheet | assumption | setting`.

Unknown is explicit: fields are `cents | null`, never defaulted to 0. A report with nulls is `complete: false` and lists `missing: string[]`; comparison ranks incomplete deals in a separate band.

## Data model (Postgres, RLS on every table)

Offers are snapshots. Each revision stores the full offer as validated JSON, so diffing, revision history and the engine input are the same shape.

| Table | Purpose |
|---|---|
| `allowed_emails` | allowlist used by RLS (`auth.jwt()->>'email'` must match). Seeded by migration from the same list as `ALLOWED_EMAILS` env. All allowed users share all data (you and your wife see the same deals). |
| `deals` | dealership name/address/phone/website, salesperson, status (`verbal`/`written`/`expired`), `quote_expires_on`, vehicle (VIN, year, model, trim, powertrain, colors, stock number, stock date), `sticker jsonb` (line items + total), `archived_at` |
| `deal_revisions` | `deal_id`, `revision_no`, `offer jsonb` (selling price, line items with category/source/taxable/note, trade allowance, financing quotes, payment grid), `created_at`, `note` |
| `trade_profile` | single row: trade VIN/year/model, `payoff_cents`, `payoff_good_through` |
| `outside_offers` | source, amount, expires_on, contingent_on_inspection |
| `attachments` | deal_id, storage path (private bucket), kind, mime, bytes, width/height, thumbnail path |
| `deal_notes` | deal_id, occurred_at, who, channel (`verbal`/`written`), body |
| `benchmarks` | source, url, observed_on, sticker_cents, price_cents, kind (`paid`/`advertised`), note |
| `settings` | single row jsonb: thresholds, junk-fee list, pre-approval APR, promo rates, active tax rule version |
| `tax_rules` | versioned: state, rate, base rules, trade credit, rebate credit (+ `verified: boolean`), source URL, verified_on |
| `drafts` | optional server copy of unsaved local drafts (sync state) |

Storage: one private bucket `attachments`, 25 MB per file, PDF/JPEG/PNG/HEIC, signed URLs with 10-minute expiry. HEIC is converted to JPEG on upload in a route handler so browsers can render it.

Auth: Supabase magic link. The sign-in route refuses addresses not in `ALLOWED_EMAILS` (so no email is sent to strangers), middleware signs out any session whose email is not allowed, and RLS enforces it again at the database.

## Routes

| Route | Screen |
|---|---|
| `/` | Deals list (first screen). Each card: dealership, all-in % of SRP, OTD, open flags, status, expiry. New deal button. |
| `/deals/new` | Guided entry: dealership, VIN (decode beside entry), sticker lines, offer lines, trade allowance, financing. Sticky summary bar. |
| `/deals/[id]` | Verdict, three headline numbers, flags, itemized breakdown with tap-to-derive, trade with/without, financing audit, target builder, counteroffer text. |
| `/deals/[id]/edit` | Same editor, creates a new revision on save. |
| `/deals/[id]/revisions` | History with line-by-line diff. |
| `/deals/[id]/attachments` | Upload, thumbnails, pinch-zoom viewer, "import from this sticker". |
| `/deals/[id]/import` | Claude extraction shown field-by-field beside the image; confirm before save; blocked unless lines reconcile. |
| `/deals/[id]/notes` | Timestamped log. |
| `/deals/[id]/print` | One-page summary. |
| `/compare` | 2 to 6 deals, price-only / with-trade toggle, best value per row highlighted, frozen label column on mobile. |
| `/trade` | Payoff with good-through date, outside offers. |
| `/benchmarks` | Market data points with source, URL, date. |
| `/settings` | Tax rules, thresholds, junk-fee list, pre-approval rate, promo rates, export CSV/JSON. |
| `/login`, `/auth/callback` | Magic link. |
| `api/vin/[vin]` | NHTSA vPIC proxy with Zod on the response. |
| `api/import/sticker` | Server-only Claude call. Hidden when `ANTHROPIC_API_KEY` is absent. |
| `api/attachments/*` | Upload, HEIC conversion, thumbnails, signed URLs. |
| `api/export` | CSV and JSON. |

## Milestones

1. **Scaffold and gates.** Next 16, strict TS, Tailwind 4, ESLint, Vitest, Playwright, `pnpm verify` (typecheck + lint + engine tests). Vercel build command runs `verify` before `next build`, so no deploy ships with a failing fixture. Local git repo. GitHub Actions workflow file included for when a remote exists.
2. **Engine and golden fixtures.** Every calculation in the brief, every flag, fixture JSON for the real deal and the revision fixture, property tests for amortization (payment solves back to APR, total paid = principal + interest) and tax (monotone in base, half-up rounding, trade credit never negative). Microbenchmark proving evaluate() under 16 ms.
3. **Database, auth, storage.** Migrations with RLS, allowlist, private bucket, magic-link login, middleware, env vars in Vercel (Supabase URL and publishable key for all three environments).
4. **Deals: create, view, edit, revisions.** Money inputs with numeric keypad and paste parsing, recalculation on every keystroke, sticky summary, derivation drawer, flags, verdict, target builder, counteroffer text, notes, duplicate and archive.
5. **Trade, financing, compare, benchmarks, settings, export, print.**
6. **Attachments and sticker import.** Upload pipeline, viewer, Claude extraction with confirm-before-save and reconciliation gate.
7. **PWA, offline drafts, performance, accessibility.** Service worker, manifest, IndexedDB drafts with sync state, bundle measurement for the deals route, Lighthouse on a mobile profile, reduced-motion, WCAG checks.
8. **Verification and deploy.** Full test suite, build, Playwright on three viewports, deploy to production, open the deployed app on a mobile viewport, two fresh-context subagent reviews (engine vs calculations and fixtures; UI vs visual design and UX), fix findings, final report.

DESIGN.md (tokens, type, motion) and NOTES.md (lessons) are written during milestones 4 and 1 respectively and kept current.

## Decisions I will make unless you object

- Shared data: both allowed users see and edit the same deals. No per-user ownership.
- Money input parsing: `58.7k` means 58,700.00; a bare `58714` means dollars; `58714.5` means 58,714.50.
- Implied APR from the payment grid uses principal = dealer's stated balance minus the column's cash down, which is how the fixture reproduces.
- Georgia rebate-reduces-base rule ships marked `unverified` and off by default, with the MV-7D note, as the brief requires.
- Verdict score: 0 to 100, driven by all-in % of SRP against the thresholds, with penalties listed per flag; every driver is shown.
- Deployment protection stays as it is. Your wife will need to be a member of the Vercel team to pass the SSO wall, or you add a custom domain. The app's own login protects the data either way.

## Open questions (answer with approval, or I proceed as noted)

1. **Allowlist emails.** Which addresses should be allowed (yours and your wife's)? If you give none, I seed `subscriptions@alhuss.com` only. Adding an address later means editing the `ALLOWED_EMAILS` env var and running one small migration.
2. **GitHub.** Should I create a private GitHub repo under your account for CI? If not, the Vercel build gate still runs the fixtures on every deploy. Default: local git only.
3. **Preview/Development Anthropic key.** Add `ANTHROPIC_API_KEY` to Preview and Development in Vercel when convenient. I will not create one.

## Risks

- **Fixture images are missing.** Import is tested against synthesized images. Drop the real scans into `fixtures/source` and I will add them to the import test.
- **TypeScript 7.0 and Next 16.** TS 7 is the new native compiler. If Next's type checker rejects it I pin TypeScript 5.9.x and note it.
- **Google Drive working directory.** `node_modules` inside a synced Drive folder is slow and can trigger sync errors. If installs or builds fail for that reason I will report it and propose a local clone.
- **Supabase built-in email.** The default sender is rate-limited to a few magic links per hour. Enough for two users, but tight during testing. Custom SMTP is a follow-up.
- **HEIC.** Needs a pure-JS converter in a route handler; large HEICs may be slow on a serverless function.
- **Vercel SSO wall.** Covers every deployment URL, so Playwright against the deployed URL needs a protection-bypass token. I will run E2E against a local build and verify the deployed app manually in the mobile viewport.
- **Georgia tax edge cases.** TAVT rules for leases, out-of-state buyers and dealer fee taxability vary. The rules table carries a source and a verified date; anything I could not confirm is marked unverified.
