# BYRSADVCT design

Dark-first, product-grade, in the family of Vercel, Stripe, Supabase and Robinhood: near-black surfaces, hairline borders, one green accent that means "act here or this number decides", tabular figures everywhere, and motion that confirms rather than decorates. Light mode uses the same tokens.

## Type

Geist for text and labels, Geist Mono for VINs, stock numbers and ranks. Numbers use tabular figures (`.num`) so columns line up. Scale: 11px eyebrow labels (uppercase, tracked), 13px secondary, 15px body, 17px section titles, 26px page titles, 24px and 36px metric values.

## Color tokens (globals.css)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#09090b` | `#fafafa` | page |
| `--bg-elev` | `#0f0f12` | `#ffffff` | rail, inputs |
| `--surface` / `-2` / `-3` | `#121216` / `#18181d` / `#1f1f26` | `#ffffff` / `#f4f4f5` / `#e9e9ec` | cards, hovers, active tabs |
| `--ink` / `-2` / `-3` | `#f4f4f5` / `#a1a1aa` / `#71717a` | `#09090b` / `#52525b` / `#71717a` | text levels |
| `--line` / `--line-strong` | `#27272a` / `#3f3f46` | `#e4e4e7` / `#a1a1aa` | rules; field and button borders (3:1) |
| `--accent` | `#3ecf8e` | `#0f9d63` | primary button, active nav, decisive number |
| `--good` / `--caution` / `--flag` | green / amber / coral | darker variants | status, always paired with a word |

Every text pair meets 4.5:1. Field borders meet 3:1 non-text contrast. Status color is never the only signal: every pill has a word, every flag has a severity label.

## Shape and spacing

4px base. Cards 10px radius, inputs and pills 6px, hairline 1px borders, one soft shadow. Page gutter 16px on phones, 24px from 640px, 32px with the desktop rail. Tap targets are 44px (small buttons grow to 44px on touch screens).

## Layout

Desktop: 240px left rail (logo, nav with icons, theme and sign-out), content to 72rem. Phone: top bar, bottom tab bar with Deals, Inquire, Compare, Trade and a More sheet (native popover) for Benchmarks, Learn and Settings. Every page starts with a `PageHeader` (crumb, title, one-line description, actions). Content sits in `Section` cards with a title and an intro sentence that says what the numbers mean.

## Motion

Durations 120 / 200 / 320ms, one easing (`cubic-bezier(0.2, 0, 0, 1)`) and an out-expo for entrances. Cards rise 6px on mount with a 40ms stagger; hover lifts 1px and brightens the border; primary buttons glow on hover and press 1px; the summary bar numbers tick when they change; skeletons shimmer. `prefers-reduced-motion` turns all of it off.

## Explaining things

Every unfamiliar term renders as a dotted `Term` that opens a native popover with "what it is", "how dealers use it" and "what to ask", and links to the Learn page. Each section's intro sentence states the order of negotiation (price, trade, financing) and what the figures mean. Unknowns read "not yet quoted", never a dash or a zero.

## Copy

Plain and specific. No taglines, no exclamation points, no em dashes, no filler. Empty states name the next action and show its button.
