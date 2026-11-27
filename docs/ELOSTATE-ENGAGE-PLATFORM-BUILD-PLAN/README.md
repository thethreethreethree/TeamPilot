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
| E5 Tracker trigger | ad6c03d1 | 0380 |
| Review fixes (hidden calls, account reach, agents once, forecast paging) | 91b1eeb6 | 0381 |
| E4 completed: ask_account, generate_brief, find_calls | 18ab81dd | — |
| E6 Upload a call by API ("upload calls" key scope; the rep picks their voice in the app, E10) | ec9c69f5 | 0387 |
| E7 People and team stats in the API; the usage report | 466b5296 | — |
| E8 Agent templates; the gone-quiet trigger | 6492121e | 0389 |
| E9 On-demand agents from the deal's Ask box | (this commit) | 0389 |

Waiting on outside setup (each named in docs/00 and docs/08): automatic email (Postmark), the dialer (Twilio), per-person
MCP keys (a JWT secret), CRM sync (a client's CRM). Date-based agent triggers and warning history are built (0382, 92249504) and run nightly; CRON_SECRET is set in production (the cron route answers 401 without it).

Read `docs/00-OPEN-DECISIONS.md` first; then 01–08; `BUILD-PLAN/00-BRIEF.md`; and the scaffold `elostate-engage/` (`npm test`).
