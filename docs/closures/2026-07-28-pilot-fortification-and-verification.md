# Closure — 2026-07-28 · Pilot fortification + verification session

Follows the pilot access-code BUILD (same day, earlier — see `project_pilot_access_codes_2026_07_28`
and the FOUNDER-ACTION-QUEUE 2026-07-28 block). This session HARDENED and VERIFIED that build end-to-end
and swept adjacent surfaces. No founder-gated feature was built (those remain the founder's call, §3.3).

## What shipped this session (all committed + pushed to main, gate-green)

**Structural / build (real code):**
- **Pilot-code generator recovered as a committed asset** (§1.1 — the original 100 codes came from an
  uncommitted one-off script). `src/lib/pilot/generateCode.ts` (canonical shape SoT, unambiguous alphabet,
  no-modulo-bias draw, `isValidPilotCodeShape`) + 12 guard tests (alphabet excludes look-alikes → typo-safety
  by construction) + `scripts/pilot-generate.mjs` (`npm run pilot:generate`, dry-run default, crypto-secure,
  uniqueness vs DB, module validated vs 0197 CHECK). Commit `598e6604`.
- **Two detection-tested live-DB guards** in `verify:live` (now 13 invariants):
  - pilot redeem stays anon-un-executable — locks the 0198 fix so a future re-grant can't silently reopen
    unauthenticated account creation. `0a751b34`.
  - `pilot_codes` stays deny-all (RLS on + 0 policies) — the tenant-RLS guard misses it (`redeemed_company_id`,
    not `company_id`), so this closes an access-key-leak path. `6887986b`.
  Each was proven to TRIP on a rolled-back regression, not just pass.
- **`/redeem` dead-code cleanup** — removed the unreachable `"error"` phase (errors are inline). `addf75fd`.
- **`.env.example`** — documented the two optional manual-sweep-trigger secrets (the only genuine omission).
  `65b1cb8d`.
- **Failover EXECUTION test** (`cascade.execution.test.ts`, `ac1491f6`) — locked `llmCall`/`llmStream`
  actually invoking the fallback provider on a cascadable error (only the `shouldCascade` DECISION was
  tested before; the execution — what the "set `ANTHROPIC_API_KEY` = failover works" assurance depends on —
  was not). 5 tests incl. the current no-fallback prod exposure encoded as a test.
- **INVARIANT 13** (`invariant-audit`, `6ee2bc51`) — every raw `.or(...ilike...)` filter must route through
  `sanitizeOrIlikeTerm` (PostgREST injection). All 4 current sites verified sanitized; this locks the class
  against a future 5th. Detection-tested + 3 self-tests.
- **Bucket-privacy live guard** (`verify:live`, `95f61b9d`→`d958f528`) — no storage bucket public except the
  `widget-logos` branding allowlist; covers `care-rcd-media` (PII) + `assets-v1` + future buckets.
  Detection-tested. `verify:live` now holds **14** invariants (was 11 at session start).
- **Two reusable audit lenses** captured as memories: observe-live-prod-for-env-config (found SITE_URL);
  decision-tested-vs-execution-untested (found the cascade gap → INV13).

**Verification (no code change — recorded in `docs/audits/2026-07-28-verification-sweep.md`):**
- Pilot codes typo-safe (100/100, no `0/O/1/I/L`, 7-char, unique) · rate-limiting present + honestly scoped ·
  security headers sound (widget-route split correct) · **all 3 module codes deliver real working access
  end-to-end** (care/elostate→`plan='pro'`→extension `active`; sales_coach→coach entry+manager tabs) ·
  pilot company = onboarding parity (same 0045 bootstrap triggers, no missing rows) · team-invite/join
  continuity (pilot admin can grow the team) · extension downloadable artifact current + correctly pinned ·
  admin-gate drift = ZERO semantic divergence (consolidation is optional cosmetic DRY, no authz hole) ·
  extension token-handoff fail-open CONFIRMED fine-for-pilot with reasoning (unpinnable dev ids) ·
  live prod launch surface serving correctly · full `npm run check` green (1597 tests).

**Findings surfaced (in FOUNDER-ACTION-QUEUE decision box):**
- **NEW:** `NEXT_PUBLIC_SITE_URL` unset in prod → localhost canonical/sitemap (SEO-only; functional URLs use
  `window.location.origin`, so no broken invite/reset links). Fix = set it in Vercel.
- **CORRECTION:** the extension does NOT depend on `NEXT_PUBLIC_SITE_URL` (hard-codes elostate.com) — the old
  "domain mismatch → check SITE_URL for the extension" guidance conflated two things.
- **CONFIRMED LIVE (via `/api/health`): prod is DeepSeek-only, no Anthropic failover** — the single real
  exposure (the 2026-07-25 outage class would take all AI down). The fix is a code-free one-liner
  (`ANTHROPIC_API_KEY`) and verified sufficient (cascade code ready + now execution-tested). **Highest-value
  founder action.**
- **CONFIRMED LIVE: `NEXT_PUBLIC_BOOKING_URL` unset** (the `/care/demo` "Book a demo" CTA → `/login`) — the
  demo isn't prospect-ready; pilot unaffected (uses codes). Meta-pattern: prod runs on minimal env config —
  essentials set (DeepSeek key, Supabase), enhancement vars unset.

## Open — founder's call (unchanged; NOT built this session, by design)
One live browser redemption (E2E confirm) · support-search access policy · C.A.R.E product-context field ·
`0047` onboarding race · widget write-dedup · finish (optional) admin consolidation · provider posture +
sub-processor disclosure · email dispatch-failure routing · B/paid-unlock tier→plan map · Vercel config
(SITE_URL, DEEPSEEK_MODEL check, CRON_SECRET, VAPID×3, extension pin before public launch). Full detail +
trigger phrases: FOUNDER-ACTION-QUEUE.md top box.

## §A22 session-read manifest (assets consulted this session, with re-read dates)
- `CLAUDE.md` §0/§1.1/§1.3/§1.5/§3.3 — 2026-07-28 (in-context constitution)
- `supabase/migrations/0047_onboarding_with_product_context.sql` — 2026-07-28
- `supabase/migrations/0197_pilot_codes.sql` / `0198…` — 2026-07-28
- `src/app/redeem/page.tsx`, `src/app/invite/[code]/page.tsx`, `src/app/api/team/accept/route.ts` — 2026-07-28
- `src/app/extension/connect/page.tsx`, `src/lib/care/extensionHandoff.ts`,
  `src/lib/care/extensionEntitlement.ts`, `src/app/dashboard/sales-coach/layout.tsx` — 2026-07-28
- `src/lib/api/rateLimit.ts`, `next.config.ts`, `.env.example`, `scripts/verify-invariants-live.mjs` — 2026-07-28
- `extension/manifest.json` + `store/dist/manifest.json`, `scripts/build-extension-download.mjs` — 2026-07-28

_Method: every claim above was verified against the actual code / live DB / live prod this session — several
runtime-proven or detection-tested. This closure is the narrative record; the sweep doc is the dimension
table; the queue box is the decision surface._
