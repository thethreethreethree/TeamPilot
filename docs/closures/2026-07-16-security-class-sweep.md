# Security audit — four-class sweep (2026-07-16)

Recorded per §1.7.4 (audits immutable + comparable). This session swept four attack-surface classes across the
API. Two yielded real fixes; two verified clean. Every "clean" was earned by inspecting the candidates (§1.7.3),
not asserted. A future security pass should compare against this baseline.

## 1. Session / route authorization — 1 FIX
- **`PATCH /api/coach/sales-session/[id]` rename** was authorized by `getSession` (company-visibility), the
  right bar for a *manager status transition* but wrong for a *rename* — any company member could relabel a
  colleague's session via a crafted PATCH (UI was owner-gated; API wasn't). **Fixed `6d7938d`** → owner-only
  (`existing.agentId === auth.uid()`), **tested** (`route.authz.test.ts`, 6). Full write-authz table:
  docs/closures/2026-07-15-elostate-coach-write-authz-audit.md.

## 2. Secret comparison (timing side-channel) — 1 FIX
- **`POST /api/care/durability-sweep`** compared its `CARE_DURABILITY_SWEEP_SECRET` header with a plain `!==`
  (short-circuits on first differing byte → timing leak). Every other secret-checking route uses
  `constantTimeEqual`. **Fixed `f5e82b1`** → constant-time; corrected `constantTime.ts`'s stale "3 sites" note
  to an explicit rule. **Class now uniformly constant-time**: durability-sweep(+cron), task-overrun(+cron),
  backfill-dissects-cron, finance deliver-cron, inbound-email webhook. `health`/`settings` only do
  `Boolean(process.env.*_API_KEY)` existence checks (no comparison).

## 3. Service-role routes (RLS bypass) — CLEAN (verified)
Every admin-client API route is authorized — via mechanisms an incomplete grep initially missed. Manually
inspected the highest-risk candidates:
- `files/[id]` → `getCurrentAuthContext` + explicit uploader/admin check on the admin path.
- `care/agent/tenant` → `requireCareAgent` (admin-only, company-scoped).
- `care/conversations/[id]/file/[fileId]` → session token → conv-id match → file-belongs-to-conv →
  `access_role === 'everyone'` (no cross-conversation/tenant leak).
- `care/tts` → `x-care-session` token → conversation resolve.
No ungated admin-client route found. (The one real service-role gap this session — the rename — is in class 1.)

## 4. LLM rate-limiting (cost-DoS) — CLEAN (verified)
Every route that actually invokes an LLM carries `rateLimit` (spot-confirmed after-pitch, cue). The two grep
flags (`health`, `settings`) make no LLM call — they matched the `ANTHROPIC_API_KEY` existence check.

## Baseline note for the next pass
- New secret checks MUST use `constantTimeEqual` (enforced-by-convention; grep `!==.*secret|token|Bearer`).
- New admin-client routes MUST gate the caller (user context / care-agent / session token / cron secret) AND
  scope every query to the caller's tenant.
- New LLM routes MUST carry `rateLimit`.
