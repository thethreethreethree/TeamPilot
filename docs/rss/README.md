# ELOSTATE Remote Sales System — Build Plan

An addition to the live ELOSTATE (TeamPilot) Sales Coach: phone and video sales sessions captured,
scored and coached to Gong's level, with a reporting tree so each manager coaches their own team.
It builds Part A of *Gong vs ELOSTATE: what it takes to match*. It is not a new app.

## State of the plan

```
Features      63   ██████████████████████████████████████████████████████░░░░░░░░░
              SETTLED 5 · DESIGNED 55 (7 waiting on a value) · PROPOSAL 2 · NOT DECIDED 1
Decisions     17 open · 3 closed   (docs/00 - read first)
Migrations    9   0271-0279, one per phase (Phase 6 needs none), each with a preflight
Tests         99 passing: 51 rules + 48 RLS (allowed + refused pairs), on PGlite
Typecheck     clean (TypeScript 5, strict)
Repo access   NONE - written from the comparison's file:line evidence at commit 0214913
```

## Read in this order

| Doc | What it holds |
|---|---|
| `docs/00-OPEN-DECISIONS.md` | **Read first.** 20 decisions, what stands in for each, when changing it gets expensive. Plus what is deliberately not built. |
| `docs/01-SCOPE.md` | The remote session and its lifecycle, roles, what carries across, what doesn't, what "done" means |
| `docs/02-FEATURE-MENU.md` | Every feature by phase: SETTLED / DESIGNED / PROPOSAL, with Gong IDs |
| `docs/03-DATA-MODEL.md` | New tables, who reads and writes each, the access rule, what is deliberately absent |
| `docs/04-CONVERSATION-METRICS.md` | Stat definitions, scoring maths, trackers, failure reasons |
| `docs/05-ROUTES.md` | Changed and new routes |
| `docs/06-UI-SPEC.md` | Session page, close sheet, inbox, metrics, find, training, admin |
| `docs/07-BUILD-ORDER.md` | Phases 0–9, each ending in something to look at |
| `docs/08-DEPLOYMENT.md` | Vercel, `db:apply`, crons, env, storage quota |
| `BUILD-PLAN/00-BRIEF.md` | The same plan as the ten-section brief, decisions log, open questions |
| `BUILD-PLAN/reference/` | Source material, in precedence order |
| `elostate-remote-sales/` | The scaffold: rules as code, migrations with RLS, tests |

## Run the scaffold

```
cd elostate-remote-sales
npm install
npm run check      # typecheck + 99 tests
```
