# BUILD — capture-cost dashboard

## Feature inventory

### Manager capture-health count (`/api/coach/sales-session/capture-health` + Settings Capture-health card)
- write-path: none (read-only diagnostic). N/A.
- read-path: `GET /capture-health` (manager-gated via `isSalesCoachManager`, company-scoped via
  `getCurrentCompanyId` + RLS) → `total` (exact head count of ended/reviewed sessions), then pages the ended
  rows (`id, audio_asset_url`) and the transcript segment `session_id`s (batched ≤1000 ids, each via
  `fetchAllPaged`), derives `failed` (ended sessions with no segment), `recoverable` (failed but
  `audio_asset_url` set), `lost` (failed + no audio), and `failureRate`. The Settings → Coaching
  `CaptureHealthCard` renders it on a "Check" button. Locked by `capture-health/__tests__/route.test.ts`.

## Files changed
- **src/app/api/coach/sales-session/capture-health/route.ts** (NEW) — the count route (exact head + batched
  paged reads; fail-loud past the fetchAllPaged backstop; honest zero; manager gate).
- **src/app/dashboard/sales-coach/settings/page.tsx** — `CaptureHealthCard` + wired into the coaching tab
  after the voice-health card.
- **src/app/api/coach/sales-session/capture-health/__tests__/route.test.ts** (NEW) — 401 / 403 / honest-zero /
  the failed·recoverable·lost derivation.

## Holistic (§1.5.1)
Read-only + manager-gated + company-scoped; no writes, no schema, no new provider calls. Mirrors the
voice-health diagnostic (the incident's "why") — this is the incident's "how much". Both live in Settings →
Coaching.
