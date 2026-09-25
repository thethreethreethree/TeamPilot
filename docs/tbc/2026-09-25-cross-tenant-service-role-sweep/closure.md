# CLOSURE — the service-role routes, query by query

## What is true now

One cross-tenant read is closed and pinned by a test whose mock honours filters. One cross-tenant
write is found, evidenced, and with the founder — it reverses a recorded ruling of his.

## The finding

The calibration leak passed its tests because the mock's `.eq` returned the row whatever you
filtered on. **A mock that ignores filters cannot test a filter**, and every tenancy guarantee on a
service-role route IS a filter. Same shape as today's other vacuous checks, in the one place where
vacuous is a security property.

## Residual

```json
[
  {
    "id": "R1-add-member-cross-company",
    "item": "team/add-member existing-mode moves a user from any company into the caller's.",
    "why_skipped": "Reverses a recorded founder ruling; asked in a picker.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T12:30:00Z",
    "outcome": "OPEN pending the founder."
  },
  {
    "id": "R2-four-route-groups-unread",
    "item": "team-analytics, list, care/inbound/email, the three crons.",
    "why_skipped": "Stopped to surface R1.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T12:30:00Z",
    "outcome": "OPEN. Next."
  },
  {
    "id": "R3-other-route-tests-with-filter-blind-mocks",
    "item": "The calibration builder pattern (every method returns the builder, resolves one fixed row) is likely copied across other service-role route tests.",
    "why_skipped": "Not yet swept.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T12:30:00Z",
    "outcome": "OPEN. Any tenancy claim resting on such a test is unproven."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended 2026-09-25 — R1 ruled and closed

Founder picked **"Refuse it (Recommended)"**. `team/add-member` existing-mode now returns 409 when the
account already belongs to a different company, and writes nothing. No-company and same-company adds
are unchanged. The other company is not named in the response.

Also fixed on the way: the profile read that decides this had its error discarded, so a failed read
came back as `cur = null` — indistinguishable from "no company" — and the move would have proceeded.
It now fails CLOSED with a 500 and a generic sentence (CWE-209).

Mutation: remove the refusal and the fail-closed branch → 2 of 9 fail. The dialog surfaces the
sentence (`AddAgentDialog.tsx:57`).

R1 outcome: CLOSED.

## Appended 2026-09-25 — R2 closed, R3 answered with a gate

R2: team-analytics, list, coach-assessment, care/inbound/email, the suggestion inserts and the crons
were read. Every id list derives from a company-scoped read, a row this request created, or a
tenant resolved from the delivered-to address. R2 outcome: CLOSED.

R3: the filter-blind mock is widespread (regex count, a suspect not a finding: 39 of 53 service-role
route tests stub `.eq` ignoring arguments; ~7 assert a company filter). Rewriting 39 tests protects only
the routes that exist today. Answered instead with INVARIANT 29 in `scripts/invariant-audit.mjs`: every
service-role statement in a route must name `company_id`, or be allowlisted as `file::table::filter` with
the guard that makes it safe. 45 entries, each one a guard read today. Stale entries fail.

Mutation-tested: (M1) calibration leak restored → caught at :138; (M2) a new unscoped shape added to an
already-excused file → caught (a file-keyed allowlist would have waved it through); (M3) an excused
statement removed → the stale exception is reported. Restored → 0.

Stated limit: the add-member refusal cannot be seen by the scanner (company id carried in a variable);
it is excused WITH that reason and pinned by its unit test instead.

npm run check: CHECK_EXIT=0, 715 files, 5,530 passed.

R3 outcome: CLOSED as a gate; the 39 filter-blind tests remain and prove nothing about tenancy on their own.
