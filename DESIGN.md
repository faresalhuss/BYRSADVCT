# BYRSADVCT design

The app is a financial instrument, not a brochure. Numbers are the content; everything else gets out of their way.

## Type

| Role | Face | Why |
|---|---|---|
| Display and section headings | Newsreader (serif, optical sizing) | Editorial weight without looking like a template. Used sparingly: page titles, the verdict headline. |
| Text, labels, numbers | IBM Plex Sans | Clear at small sizes, has real tabular figures, pairs with the serif. Not Inter. |

Numbers always use `font-variant-numeric: tabular-nums` and are right-aligned in tables. Two decimals for money, two for percentages, three for APR when precision matters. Negatives carry a leading minus, never parentheses or color alone.

Scale (rem): 0.75 (meta), 0.875 (body small), 1 (body), 1.125 (lead), 1.5 (section), 2 (page title), 2.75 (hero number). Line height 1.45 for text, 1.1 for numbers.

## Color tokens

One accent with one meaning: **verdigris** marks the thing you act on or the number that decides (links, primary button, the active tab, the headline ratio). It is never decoration.

Status colors are tuned to the warm neutral palette and never the only signal; each is paired with a word or an icon.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--bg` | `#f5f2ec` (warm paper) | `#121416` | Page |
| `--surface` | `#fffdf9` | `#1b1e21` | Cards, inputs |
| `--surface-2` | `#ece7df` | `#24282c` | Table stripes, sticky bars |
| `--ink` | `#1a1c1e` | `#eceae4` | Text |
| `--ink-2` | `#5a5e63` | `#a6a9ad` | Secondary text |
| `--line` | `#d8d2c7` | `#33383d` | Borders |
| `--accent` | `#1f6f6a` | `#4fb3ab` | Action, decisive number |
| `--accent-ink` | `#ffffff` | `#0c1211` | Text on accent |
| `--good` | `#2f6b3a` | `#7cc287` | Strong, best in row |
| `--caution` | `#8a5a00` | `#e0a63a` | Caution |
| `--flag` | `#9a2f22` | `#ec7b6a` | Money being hidden |
| `--good-bg` / `--caution-bg` / `--flag-bg` | tinted at 10% | tinted at 16% | Pills and row highlights |

Contrast: every text/background pair is at or above 4.5:1; large numbers at or above 3:1. Focus ring: 2px `--accent` outline with 2px offset, always visible.

## Spacing and shape

4px base. Components use 8/12/16/24/32. Page gutter 16px on phones, 24px from 640px.

Radius is small and purposeful: 4px on inputs and pills, 8px on cards, 999px only on the status dot. No uniform heavy rounding, no gradient borders, no glass.

Tap targets are at least 44px tall. Money inputs open the numeric keypad (`inputmode="decimal"`).

## Motion

One duration (140ms) and one easing (`cubic-bezier(0.2, 0, 0, 1)`), used for the derivation drawer opening and the sync indicator. Nothing fades up on scroll. `prefers-reduced-motion: reduce` turns every transition off.

## Layout rules

- The sticky summary bar on a deal shows three numbers only: all-in % of total SRP, out the door, open flags.
- Progressive disclosure: every number on screen is a button that opens its derivation (formula, inputs, sources).
- Compare: label column frozen, deals scroll horizontally, best value per row marked with color and a check mark.
- Empty states say the next action in plain words, with the one button that does it.

## Copy

Plain, specific, no taglines, no exclamation points, no em dashes, no filler. "Not yet quoted" instead of a blank or a zero.
