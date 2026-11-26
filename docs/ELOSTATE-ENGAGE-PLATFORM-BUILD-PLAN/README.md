# EloState Engage, API, MCP and agents — build plan

The rest of the revenue stack after `ELOSTATE-REVENUE-BUILD-PLAN` (Phases 1–6, shipped 2026-11-27).

```
Features      12   DESIGNED 11 · PROPOSAL 1 group (00, deliberately not built)
Decisions     9 open (docs/00), none block E1
Tests         5 passing (flow schedule, enrolment states, outcomes)
Phases        E1–E5
```

## Shipped (2026-11-27)

| Phase | Commit | Migration |
|---|---|---|
| E1 Flows, enrolments, today's steps, call outcomes, contact email/phone | bd33c44f | 0377 |
| E2 Engage analytics | 7fc22de3 | — |
| E3 Public read API, company keys, usage | 602cdcc2 | 0378 |
| E4 MCP server | 9eb3a304 | — |
| E5 Agents | 353dc762 | 0379 |

Waiting on outside setup (each named in docs/00 and docs/08): automatic email (Postmark), the dialer (Twilio), per-person
MCP keys (a JWT secret), date-based agent triggers and warning history (CRON_SECRET), CRM sync (a client's CRM).

Read `docs/00-OPEN-DECISIONS.md` first; then 01–08; `BUILD-PLAN/00-BRIEF.md`; and the scaffold `elostate-engage/` (`npm test`).
