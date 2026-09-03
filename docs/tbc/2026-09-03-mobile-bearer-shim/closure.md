# CLOSURE — accept a mobile Bearer token on the coach routes

## What shipped

Five coach route groups now accept either the web SSR cookie session or a mobile
`Authorization: Bearer <supabase access token>`: `kpi/{me,team,trajectory}`, `sales-session`
(create), and `sales-session/[id]/{outcome,upload-recording,upload-recording/sign,label-transcript}`.

Two helpers do the work. `resolveApiAuth` widens **identity** — cookie first, then a Bearer
token validated the way `requireExtensionAuth` already validates one — and returns the
identical `AuthContext` the routes consume. `callerScopedDb` returns a Supabase client built
from the anon key plus the caller's own JWT, and `getSession` / `getSessionTranscript` take
it as an optional argument.

The session routes needed the second helper because their access check is an RLS-scoped
read, not an auth call. `06-BACKEND-BEARER-SHIM.md` describes them as the same one-line
change as the KPI routes; they are not, and following it literally produces routes that
authenticate a caller and then 404 their own session.

## Verification (A38)

`npm run check` — all seven commands, one invocation, after the final edit — **exit code 0**.
Output pasted in check.md. Its first run exited 1 and is recorded there as finding F2.

## Residual

```json
[
  { "id": "R1",
    "item": "upload-recording/sign/route.ts — the fourth application of the same one-line client substitution, changed by pattern after the first three were reasoned through individually.",
    "why_skipped": "By the fourth route the substitution felt mechanical: same shape, same neighbours, tests green. That confidence is exactly what A36 says to distrust.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-03T03:05:00+08:00",
    "outcome": "Opened and read whole. The substitution is correct here, and reading it settled something I had assumed rather than checked: getCurrentCompanyId() is called on EVERY request including mobile, where it builds its own cookie client and cannot succeed. It is wrapped in try/catch returning null (src/lib/supabase/auth-helpers.ts:16-30), so a mobile caller falls through to the profiles read as intended rather than 500-ing. Had that helper thrown instead of returning null, all four session routes would have failed for every mobile caller — and no test would have caught it, because no test exercises the Bearer path against a real cookie store. The cost that remains is a wasted round trip per mobile request; not worth a branch here, worth knowing." },

  { "id": "R2",
    "item": "The Bearer path has no automated test anywhere. Every test in this branch exercises the cookie path or the audit script.",
    "why_skipped": "Testing it honestly needs a real Supabase JWT and a real PostgREST; a mocked one would assert my own reasoning back at me, which is worse than nothing because it reads as coverage.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null },

  { "id": "R3",
    "item": "scripts/invariant-audit.mjs now accepts two more names as auth gates — a widening of a security guard, made from inside the branch that guard was flagging.",
    "why_skipped": "Not skipped so much as bounded: three self-tests were added, including one asserting it still rejects an ungated mutation. What was not done is an independent review of the widening.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null }
]
```

## The un-named reliance

**Nothing has been proven against a live deployment.** Every claim here rests on static
analysis and unit tests. The reasoning that a caller-scoped anon client makes `auth.uid()`
resolve to that user, and that every existing RLS policy therefore applies unchanged, is
*sound* and *untested against a real PostgREST*. The curl checks that would settle it —
including that a Bearer for rep A never returns rep B's rows — are written out in
`Elostate-Sales-coach/PHASE-3-SHIM-TO-APPLY.md` and have not been run. **Run them before
deploying.**

## What this unblocks

The native app's KPI board, month-by-month trend, team roster, recording upload, speaker
attribution, outcome and deal value, and session rename. All are written and tested
app-side and currently render an honest "not switched on yet" on the 401 they receive today.

## What was got wrong on the way

Three things, all on the record rather than tidied away. `/outcome` was briefly made to
require a company context it never required — a regression to the **web** path introduced
while adding mobile support, caught only because that route had tests (check.md F1). The
canonical gate was substituted with a faster subset for most of the build, and the first
full run failed on an unused import the subset could not see (check.md F2). And a helper,
`resolveApiDb`, was written on an assumption about the `profiles` read and then deleted
when reading the code showed the assumption was wrong.
