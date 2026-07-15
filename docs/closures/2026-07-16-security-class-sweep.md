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

## 5. CSV formula injection (CWE-1236) — CLEAN (verified)
Every CSV **exporter** routes user data through the neutralizer (`export/[entity]` via toCsv/csvSafe;
finance contractors / reports / statements). The two grep flags (`finance/banking`, `finance/cards`) are
CSV **importers** (`parseCsv` / statement upload → `/import`) — they read CSV, never write it, so
formula-injection (an export-opened-in-Excel attack) doesn't apply. Baseline rule: a new CSV EXPORT must
route cells through `neutralizeCsvFormula`; imports don't need it.

## 6. Signal-integrity (pre-activation) — 1 FIX (added same session, after wiring the task-overrun cron)
Wiring the dormant task-overrun sweep into `vercel.json` (`8bebaf5`) prompted a correctness pass on the
logic it fires. The candidate filter (0109) treated `status <> 'Completed'` as "still open", but 'Cancelled'
is also terminal (server transition map, `tasks/route.ts:214-219`) and reachable via a direct API PATCH
(the route validates status against the map, not the create-enum; `tasks.status` has no DB CHECK). So an
overdue **cancelled** task would emit a false `task_slipped` signal into the append-only §3.1 chain — §A25
(false match worse than a miss) polluting a §3.5 hard metric. **Fixed `7098820`** → migration `0184`
(create-or-replace both functions, `not in ('Completed','Cancelled')`, both the candidate query and the
emit re-check). **UNAPPLIED** — founder applies. Caught BEFORE first emission (cron dormant until
CRON_SECRET), so no historical false-slip to clean up. Verified by SQL reading + transition-map evidence,
NOT a unit test (the predicate lives in the DB function). Flagged same-class-lower-consequence, not fixed:
team-check nudge / staleness badge (`status === 'Completed'`) act on cancelled tasks; and the server
transition map allows 'Cancelled' while the create enum + web-UI map omit it (a source-of-truth split).

## Baseline note for the next pass
- New secret checks MUST use `constantTimeEqual` (enforced-by-convention; grep `!==.*secret|token|Bearer`).
- A new "task is still open" predicate MUST exclude BOTH terminal statuses (`Completed`, `Cancelled`), not
  just Completed — especially any path that writes to the immutable §3.1 event/signal chain.
- New admin-client routes MUST gate the caller (user context / care-agent / session token / cron secret) AND
  scope every query to the caller's tenant.
- New LLM routes MUST carry `rateLimit`.
