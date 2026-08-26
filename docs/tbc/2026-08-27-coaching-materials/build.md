# BUILD — Coaching materials library

### the generator (prompt + parse)
- write-path: `coachingMaterial.ts` — `buildMaterialSystemPrompt(corpus)` (teach from the team's own methodology, plain
  voice) + `parseCoachingMaterial` (```json fence tolerant; array caps 4/3/3; null on malformed / nothing-teachable).
  Shape {overview, keyMoves[], watchOuts[], exampleLines[]}.
- read-path: a concrete guide, or null → honest "couldn't load".

### the route
- write-path: `coaching-material/route.ts` (POST, authed, company-scoped, rate-limited 20/min, maxDuration 60,
  CONVERSATION_IS_DATA fenced) → dissectCoachV5 + corpus → `{ material }` (null = honest fallback, not a 5xx).
- read-path: the Training tab fetches a guide for a focus.

### the surface
- write-path: `training/page.tsx` — `FocusItem` gains a "Learn" button (beside "Practice"); `MaterialPanel` renders the
  guide inline (overview / key moves / watch-outs / lines to try), fetched on first open with its own state.
- read-path: a rep reads the guide, then practises the same skill — learning alongside the drill.

## Files
- `src/lib/coach/v5/coachingMaterial.ts` — prompt + parse.
- `src/lib/coach/v5/__tests__/coachingMaterial.test.ts` — 5 honesty tests.
- `src/app/api/coach/sales-session/coaching-material/route.ts` — generation route (fenced, gated, maxDuration).
- `src/app/dashboard/sales-coach/training/page.tsx` — Learn toggle + MaterialPanel.

## Ripple (§6 item 5)
New module + route + a per-focus Learn toggle (own fetch state). The practice / scored-review / analytics paths are
unchanged. Best-effort generation (null → honest "couldn't load") so the tab never breaks. New LLM route carries the
injection fence + maxDuration.

## Honest limit
Guides are generated on demand (not stored) — consistent with the corpus-grounded, no-CMS approach; each open regenerates.
A saved/curated library is an additive slice.
