# EloState revenue stack — build plan

What EloState needs to compete with Gong beyond coaching: accounts, deals, warnings, playbooks, AI deal review, win/loss, ask-anything and forecast. It builds on the calls, coaching and prospects already live.

## Shipped (2026-11-27)

| Phase | Commit | Migration |
|---|---|---|
| 1 Accounts and contacts | 165aec25 | 0370 |
| 2 Deal board, stages, saved views | b3e87459 | 0371 |
| 3a Gong's deal warnings in dealRisk | c5cd8ecd | 0372 |
| 3b Playbooks and the AI Deal Reviewer | 043e5d4d | 0373 |
| 3c Deal brief and next steps | 3fa22495 | 0374 |
| 4 Win/loss, drivers, account activity | af193246 | 0375 |
| 5 Ask about a deal or account | 06b452cd | — |
| 6 Forecast board | b527c7c4 | 0376 |

Next: `docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN` (Engage, API, MCP, agents).

## State of the plan (as written)

```
Features      27   ████████████████████████████████████████░░░░
              DESIGNED 22 · PROPOSAL 5 (deliberately not built)
Decisions     12 open (docs/00, read first), none block Phase 1 · 2 closed
Migrations    5    0370–0374, one per phase that needs one
Tests         14 passing: warnings, activity level, playbook states, win/loss, account keys
Phases        6 detailed + Engage / CRM / agents planned separately
```

| Doc | What it holds |
|---|---|
| `docs/00-OPEN-DECISIONS.md` | **Read first.** 12 decisions, their stand-ins and the cost of each |
| `docs/01-SCOPE.md` | Entities and lifecycle, roles, what carries across, what "done" means |
| `docs/02-FEATURE-MENU.md` | Every feature with its Gong ID and status |
| `docs/03-DATA-MODEL.md` | Tables, RLS, erasure, and what's absent |
| `docs/04-REVENUE-RULES.md` | Warning kinds, activity level, playbook states, win/loss, matching |
| `docs/05-ROUTES.md` · `06-UI-SPEC.md` · `07-BUILD-ORDER.md` · `08-DEPLOYMENT.md` | Routes, screens, phases, deploy |
| `BUILD-PLAN/00-BRIEF.md` | The ten-section brief, decisions log, open questions |
| `elostate-revenue/` | Rules as code and tests: `npm test` (Node 24, no install) |
