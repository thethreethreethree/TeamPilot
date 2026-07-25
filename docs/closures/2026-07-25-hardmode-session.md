# Closure — 2026-07-25 HARD MODE autonomous session

Consolidated record of this session's work so the founder has ONE actionable list
instead of findings scattered across the transcript. All commits pushed to `main`
(auto-deploys to Vercel). Suite 1405 pass · tsc clean · production build exit 0.

---

## 🚨 FOUNDER ACTIONS — do these first (they gate whether the deploy works)

1. **Check Vercel env `DEEPSEEK_MODEL`.** Code reads `process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash"`. If Vercel has it set to a stale `deepseek-chat`, it OVERRIDES the fix and every AI tool stays broken. Remove it (so the default applies) or set it to `deepseek-v4-flash`.
   - **Verify:** Settings → LLM Connection → Run test. Shows the effective model. `deepseek-v4-flash` = fixed; a `model_unavailable` error = stale `DEEPSEEK_MODEL`.
2. **Decide on `ANTHROPIC_API_KEY`.** It's empty, so there's a **single provider — no failover** (the panel now warns about this). Any DeepSeek outage/rename/quota block downs all AI with no fallback. Set an Anthropic key in Vercel to enable the cascade, or accept single-provider.

## Recommendation — proactive outage detection (would have caught THIS outage)

`/api/health` reports `llmReady: true` on **key presence only** — it deliberately
never calls the LLM (must stay token-free for frequent polls). So when DeepSeek
renamed the model, health stayed GREEN while every AI tool was down; the founder
found it via users, not monitoring. **Gap:** nothing proactively detects "the
configured model is dead / provider is failing." Recommended fix (a design call —
not built): a low-frequency real round-trip that DOESN'T bloat every poll —
either a cached LLM-health check (round-trip at most once per ~5 min) on a
SEPARATE endpoint from liveness, or an hourly cron ping that alerts on
`model_unavailable`/auth/quota. Decisions needed: where alerts go, cadence,
liveness-vs-readiness separation. The runtime cascade (once a 2nd provider key
exists) already *mitigates* such outages; this would *detect* them.

## Founder DECISIONS (surfaced, not built — §2)

- **Cascade-to-Anthropic on model/auth/quota failure** — keep, or hard-fail closed? (Moot until an Anthropic key exists.)
- **Standard-mode (4)**, see `docs/CARE-Standard-Simplification.md` §8: §3.2 one-line AI summary (per-open LLM cost) · §3.3 auto-pre-draft · §3.3 Save-draft persistence · **§3.4 resolve-capture-vs-one-click** (the sharpest — Standard-speed vs the §3.1/§1.1 learning loop).
- Prior open blockers still standing: extension entitlement write-path (A1+B1), `BOOKING_URL`.

---

## Shipped + verified this session

**AI reliability (the "all tools failing" incident — root-caused + hardened):**
- DeepSeek renamed `deepseek-chat` → `deepseek-v4-flash` (old name 400s). Model default fixed; class-swept (no other dead literals).
- `model_unavailable` LlmErrorKind: a renamed/deprecated model now FAILS OVER to the other provider instead of downing everything (was `invalid_request`, which doesn't cascade). +tests, +provider-level regression lock.
- Error-surfacing swept across every AI route (co-pilot/summarize/dissect/ask/formulate + engine) — next incident is diagnosable in seconds.

**Two real bugs found via LIVE probing (invisible to existing tests):**
- **Reasoning-model starvation** — v4-flash counts `reasoning_content` against `max_tokens`; `classifyTurnSpeaker` (cap 16) returned EMPTY (one task used 79 reasoning tokens). Fixed: provider adds +256 reasoning headroom. Verified 16→272 returns valid output. Also confirmed v4-flash DOES support `json_object`.
- **🔒 ACMS prompt-injection hole** — the static knowledge fence was forgeable; an uploaded `.md` that closes the fence early + injects a "SYSTEM OVERRIDE" made the model approve a fake $5,000 refund (2/3 runs). Fixed: per-call nonce on the boundary markers + content sanitization. Re-verified 0/4 pwned. Injection class swept: customer-message + extension surfaces are safe (role separation).

**Model migration verified end-to-end live:** non-stream + stream both yield clean content, no reasoning leak, connection stays active during reasoning (no idle-timeout risk).

**C.A.R.E surface (founder requests):**
- Composer tool order → Summarize · Co-Pilot · Ask Coach · Spawn Task; Agent Tools reveal now toggles both ways.
- §3.3 **Send & Resolve** (one entry point for reply→resolve). Honest scope corrected: the resolve step is the REQUIRED capture form, not one-click (see §3.4 decision).
- Mobile radial verified (7 routes exist + correct methods; read view gets messages; swipe/tap logic correct).

**HARD MODE guard:** the flag was stale on `STOP` since 2026-07-24, which disarmed the guard and permitted stops all session. Re-armed to `ACTIVE`; verified blocking.

---

## Security audit — service-role tenant isolation (§1.7, result: SOUND)

Swept the cross-tenant-leak class across `createAdminClient()` (RLS-bypassing) surfaces.
The pattern is uniform and correct everywhere checked — **companyId always comes from
server-side auth, never from the request:**
- **Extension** (token): `extensionAuth` resolves companyId from the *token's* user
  profile (`.eq("id", user.id)`); no route reads a request-supplied companyId.
- **Care agent** (session): scopes by `auth.companyId` + defense-in-depth
  `conversation.companyId !== auth.companyId` checks.
- **Coach sales-session** (session): companyId from the authed user's profile; role-scoped.
- **File access + serve**: grants route checks `isUploader || (isAdmin && sameCompany)`; the serve path (`getFile` → RLS client) is gated by the `files_select` policy (0057) whose FIRST clause is a cross-tenant block (`company_id in (my companies)`) — verified down to the DB, a cross-tenant file id returns null → 404.
- **Notifications / team / chat-lock**: session-auth, server-derived companyId, explicit 403s (notify-message verifies message access before notifying).
- **Crons** (no session): `CRON_SECRET` Bearer + `constantTimeEqual`, fail-closed 503 when unset.

Honest scope: audited the major clusters (extension, care agent, coach, files, crons),
not all 63 service-role sites; prior authz sweeps (0090–0111, CRM vendor fix) cover more.
No cross-tenant leak found. Separately, the ACMS injection hole (system-prompt data) was
the one real security defect this session — found, fixed, verified, unit-tested.

Also swept, all confirmatory-SOUND: **write authz** (settings/agents — admin-gated +
double-scoped `id`+`company_id` write); **inbound-email webhook** (shared-secret
`constantTimeEqual`, tenant routed by registered `inbound_email_local_part`, writes
scoped to the resolved company); **CSV formula-injection** (every export routes through
`toCsv` → `neutralizeCsvFormula` — a grep suspect on `export/[entity]` was cleared by
reading the code, A26); **upload validation** (`validateUploadCandidate` size+MIME+
extension, spoofable-MIME-aware, tested). One real defect all session (ACMS); everything
else verified sound — the A24 pattern (discovery rate → zero), reported as confirmatory.

## Session-Reads
§1.1 §1.5 §1.7 §2 §3.1 §3.2 §3.3 §3.4 §5 §6 §A21 §A24 §A26 §A27 §A30 §A38 — all re-read this session (2026-07-25) while producing the work above.
