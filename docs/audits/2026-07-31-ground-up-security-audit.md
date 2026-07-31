# Ground-up security audit — 2026-07-31 (§1.7)

Outside-view (§1.3) pass over the live API surface, foundation-up. Records what was found, what
was fixed, what was locked with a test, and what remains flagged. Every "test ✓" below whose
subject is a security boundary was **detection-tested** (the guard was proven to fail when the
protection is removed), not merely asserted green.

## Layer: multi-tenant writes (service-role bypasses RLS)

- **FINDING (fixed): `upload-recording` cross-tenant write.** Service-role write to
  `coaching_sessions.audio_asset_url` was scoped by session id only — safe today solely via an
  upstream `getSession()` RLS read (safe-by-upstream-property). Pinned `company_id` to match the
  sibling `save-recording`. Commit 8d54db32.
- **Swept the whole class** (every non-cron admin `.update()`/`.delete()` across the API): all 11
  other writes correctly scoped. Crons (recording-purge, kpi-compute) are intentionally
  system-wide over trusted internal queries. Matrix: `2026-07-31-tenant-write-scoping-class-sweep.md`.
- **Structural guard: INVARIANT 15** — every non-cron `coaching_sessions` write must pin
  `company_id`. Self-tested + detection-tested.

## Layer: IDOR / capability scoping on PUBLIC (no-auth) surfaces

- **`care/conversations/[id]/messages`** — capability-token auth (`x-care-session`); the conversation
  is resolved BY token then `conversation.id !== id → 404`. GET IDOR was tested; **POST (write-path)
  IDOR was not** — locked it independently (a conv-OTHER token cannot post into conv-1, no LLM
  reached). test ✓ (detection-tested).
- **`care/widget/bootstrap`** — token-length bound (a past-audit fix that had no regression test) +
  the 403 origin-rejected anti-embedding branch + widget-safe projection (no embed_token/plan leak).
  test ✓.

## Layer: privacy (A18 — owner-private data)

- **KPI team rollup** reads private after-pitch quality scores to derive the slippage alert but must
  expose only the derived boolean. Locked the agent object to a safe-field allowlist + asserted the
  raw scores never appear in the response. test ✓ (detection-tested).
- **`finalize` owner-only** — appending the transcript is owner-ONLY (a manager appending fabricated
  segments is the A18 transcript-injection vector). Locked: a manager who can SEE the session gets
  403, nothing appended. test ✓ (detection-tested).

## Layer: LLM injection posture (untrusted text must be DATA, not instruction)

- **`roleplay`** (rep transcript), **`care/inbound/email`** (customer email body), **extension
  `formulate`** (captured conversation) — all verified to pass untrusted content as the userMessage,
  never interpolated into the systemPrompt. roleplay locked with a test (rep line in userMessage,
  absent from systemPrompt); the others verified by reading.
- Extension routes (coach/copilot/dissect/formulate/rcd/refresh/spawn/summarize): all
  `guardExtensionRequest`-authed, `companyId`/`userId` server-derived (never client), rcd insert
  carries the server-derived `company_id`. Swept — sound.

## Layer: information disclosure (CWE-209 raw error leak)

- Whole-surface sweep completed earlier this cycle; **INVARIANT 14** guards it structurally (caught
  10 the manual grep missed). Public widget POST error path re-confirmed generic.

## Layer: data-integrity guarantees

- **KPI frozen-month history** — the compute-cron's idempotent replace must never widen its DELETE
  beyond `{current, this month}`, or frozen past-month rows (the trajectory) are wiped. Locked at the
  DELETE site. test ✓ (detection-tested).
- **TOCTOU check-then-create sweep** — candidate sites (finance opening-balances, topic-decision
  respond, file-access grant, …) are guarded by transactional RPC chokepoints, append-only
  log/event inserts (duplicates tolerated), or id-scoped updates. No new defect; the known cases
  (0197 redeem fixed, 0047 flagged) stand.

## Additional sweeps (later in the session — result noted even where clean, per §1.7.3)

- **maxDuration on LLM/heavy routes** — found 2 real prod-timeout defects (`care/demo/ask`,
  `sales/demo/roleplay` — public LLM demos with no ceiling → killed on Vercel's default). Fixed +
  locked with **INVARIANT 16**.
- **Cron scheduling** — all 7 `*-cron` routes are registered in `vercel.json` (no silently-dead cron).
  Locked with **INVARIANT 17**.
- **Rate-limit coverage on LLM routes** — clean; only the inbound-email webhook lacks a per-user limit
  (a webhook — its cost-abuse vector is the already-surfaced AI-COST-CAP item, not a new gap).
- **Un-awaited DB mutations** (silent write-loss: a lazy Supabase builder that's never awaited never
  executes) — CLEAN. Every mutation is awaited (multi-line chains await on the object line; batch
  inserts via `Promise.all`). No fire-and-forget writes.
- **Input validation on mutation routes** — the raw-`req.json()` routes validate MANUALLY (typeof/trim,
  e.g. `pilot/redeem`), not via zod, but the security-critical inputs are checked before use; RPCs are
  parameterized. No unvalidated-input-to-sink gap found.
- **CWE-209 non-finance re-sweep (complete recipe)** — the high-severity raw-DB-error leak class is
  confined to finance (fixed `rates`, scoped the rest); non-finance matches are curated `.rpc`/typed
  messages or a low-risk document-parse fallback.

## Live verification

`npm run verify:live` — **14/14 invariants hold** (append-only, finance immutability + balance, RLS
on every company_id table, storage-bucket privacy, pilot-code seal).

## Flagged / OPEN (not fixed here — by design)

- 🔴 **MEDIUM (founder-gated): finance DEFINER fns anon-callable** — the one unresolved confirmed hole.
  `0183` revoked from `authenticated, anon` instead of PUBLIC (no-op). Fix = `0200` migration +
  tighten INVARIANT 4. Gated on the founder's word ("fix the definer revoke") because it touches
  finance. Write-up: `2026-07-28-fin-definer-revoke-ineffective.md`.
- 🟡 **KPI snapshot write atomicity** (no unique constraint on `(agent_id, metric, period)` → non-atomic
  replace). Founder-gated (schema migration). Filed in FOUNDER-ACTION-QUEUE.

## Verdict

The distinct high-risk boundaries across both products (cross-tenant writes, public-surface IDOR,
A18 privacy, LLM injection, transcript-injection, CWE-209, frozen history) are each now enforced by
a detection-tested guard or verified sound. The one material open risk is the founder-gated definer
revoke. The surface is in strong shape; remaining route work is routine regression padding, not risk
reduction.
