# Session verification record — 2026-07-06

> Consolidated outside-view audit (§1.3) covering everything verified across this
> session, so §1.7.4 (audits on the record) is satisfied in one place and future
> audits can compare. Companion to the two focused audits from the same day:
> [live-attribution](AUDIT-2026-07-06-sales-coach-live-attribution.md) and
> [append-only-enforcement](AUDIT-2026-07-06-append-only-enforcement.md).
> Answers CLAUDE.md checklist #9 (last audit + open flags).

## Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · ✅ verified clean

| Area | What was checked | Result |
|---|---|---|
| **§3.1 immutability** | Is append-only DB-rule-enforced (blocks service-role) or only RLS-deep? | Coaching + core C.A.R.E strong ✅; 2 gaps (care_widget_load_events, crm_activity_events) **hardened** → `0085`/`0086` (unapplied) |
| **§3.2 understanding gate** | Where is "problem needs N signals before surfacing" enforced? | DB-**trigger** enforced (problems/route) — strongest form, unbypassable ✅; JS helper `deriveRetrospectivePatterns` tested ✅ |
| **§3.3/§3.4/§3.5/A11 guards** | Are the coach + grader pure guards regression-protected? | **All pinned** this session — review/dissect/moments/patterns/score tone-law + grounding + A11; C.A.R.E `deriveGrade`/`validateCounts`. 245 tests ✅ |
| **RLS policy coverage** | rls:audit reported 69 gaps | 33 were a **parser false-positive** (unquoted policy names) → fixed `b7e622f`; remaining 25 all verified intentional + allowlisted; **0 missing** ✅ |
| **§A11 CRM healthScore** | Is `healthScore` a forbidden system-derived verdict? | **No** — it's a MANUAL admin field (form input + healthReason), not a machine verdict. Clarified in-code `0948fd3` ✅ |
| **CRM money mappers** | Does `?? 0` on amount_cents/MRR/seat_count mask NULLs? | **No** — all three columns are `NOT NULL default 0`; `?? 0` never fires. health_score is nullable and correctly `?? null` ✅ |
| **CRM invoice numbers** | Can the `count+1` seq mint duplicate invoice numbers under concurrency? | **No** — `invoice_number` has a UNIQUE constraint (0049:195); a collision fails safe (returns null), never duplicates. Documented tradeoff ✅ |
| **C.A.R.E widget origin check** | Could a flawed allowlist match let `evil-yourbusiness.com` embed the widget? | **No** — `allows.includes(origin)` is EXACT array-element match (no substring/prefix bypass); empty origin rejected; `"*"` wildcard honored only in non-prod; Origin header is browser-set (unspoofable cross-origin) ✅ |
| **File upload path traversal** | Can a malicious filename (`evil.x/../secret`) escape the storage prefix? | **No** — `buildStoragePath` uses only trusted segments (companyId=server profile, fileId=randomUUID); the sole user input (extension) is sanitized to `[a-z0-9]` only, capped 12 chars; the raw filename never enters the key. Already tested ✅ |
| **theme leaks** | theme:audit RED on 25 | **All fixed** (`brand-shell` token + theme-aware text); theme:audit 0 ✅ |
| **lint** | 2 exhaustive-deps warnings | Fixed, incl. a real perf fix (memoized ToastProvider value) `8899c59`; 0 warnings ✅ |

## Open flags

**None constitutional.** Every invariant is enforced and (where testable) regression-pinned.

## Owed to the operator (not code)

- Apply migrations `0085`, `0086` (§3.1 hardening, unapplied).
- Live coaching test (the one high-value item code can't cover) —
  [checklist](sales-coach-live-test-checklist.md).

## Baseline note

This sweep extends the ground-up audit of 2026-07-06 (recorded in agent memory).
`npm run check` was green end-to-end throughout the session (typecheck + lint +
theme:audit + rls:audit + 245 tests).
