# REMEDIATE — Macro Mode (checkpoint)

## During-build corrections
- **View RLS-bypass (F1).** `create view` defaults to non-invoker → runs as owner → bypasses RLS. Fixed to
  `security_invoker`. First `alter` used `= on`; the rls:audit regex + repo convention want the literal
  `= true`, so `0217` restated it. Lesson: use `security_invoker = true` (canonical literal) for views.
- **Tenant-pin on UPDATE (F2).** An UPDATE policy's `with check` must re-assert `company_id = auth_company_id()`,
  or a rep can move their own row to another tenant. Fixed in `0218`.
- **Order-of-operations lesson.** I ran `db:apply` before `rls:audit`. The static audits (rls/invariant) parse
  migration TEXT and need no DB — running them BEFORE `db:apply` would have caught F1+F2 pre-apply, avoiding the
  0216–0218 fix-forward chain. Adopt: `db:dry` → `rls:audit` (+invariant:audit) → `db:apply`.

## Adjacent surfaces (§1.5.2)
- The 5 new tables mirror the coaching_sessions RLS discipline (owner-or-manager) exactly, so they inherit the
  same audited posture. Service-role-only writes to transcripts/analyses/summaries are allowlisted with reasons.
- Reused (not forked): STT (`transcribeSpeech`), storage (`ASSETS_BUCKET`), LLM (`runBrainCall`), the sales
  rubric engine, the cron-sweep pattern — no parallel infrastructure introduced.

## Residual → closure.md
Phase 3 (API route + cron worker + Sentry) and Phases 4–5 (Door Log + Report Card UIs) remain; the per-rep
toggle flag + offline queue are part of that remainder.
