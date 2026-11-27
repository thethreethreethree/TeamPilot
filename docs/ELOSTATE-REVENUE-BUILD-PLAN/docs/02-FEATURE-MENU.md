# 02 — Feature menu

Gong IDs are the teardown's (`reference/gong-teardown.json`). SETTLED = founder-decided or already in the code. DESIGNED = specified here, with stand-ins for open decisions. PROPOSAL = not built until decided.

| Phase | Feature | Gong | Status |
|---|---|---|---|
| 1 | Accounts: a record per company, name as events, find-or-create by key | F21.1 data | DESIGNED |
| 1 | Contacts: name, title, rank (`rankOf`), account | M21 `contacts` | DESIGNED |
| 1 | Backfill: each prospect's organisation becomes an account on an exact key match; near matches are suggested | — | DESIGNED |
| 1 | A call's people → contacts (from speaker names, confirmed by a person) | F29.1, by hand (R2) | DESIGNED |
| 1 | Deal contacts with a role (decision maker, champion, user, other) | F20.3 Contacts tab | DESIGNED |
| 1 | Account page: every deal, call, contact and task, as one timeline | F21.2, F21.3 | DESIGNED |
| 1 | Accounts list: name, open deals, amount open, last call, contacts, activity level | F21.1 | DESIGNED |
| 2 | Company stage list; a deal's stage as a stage id | F20.1 tabs | DESIGNED |
| 2 | Deal board: filters (rep, stage, close period, amount, account, warning), tabs saved per person, columns, roll-ups | F20.1, F20.13 | DESIGNED |
| 2 | Deal panel: Overview · Warnings · Contacts · Activity · Playbook · Brief | F20.3 | DESIGNED |
| 3 | Warnings: 7 kinds, company thresholds, nightly raise/clear events, chips and the Warnings tab with mitigations | F20.5 | DESIGNED |
| 3 | Playbooks: MEDDICC / BANT / SPICED / custom, letters on each deal | F20.6 | DESIGNED |
| 3 | AI Deal Reviewer: for each element, evidence from the deal's calls with the lines cited → a suggestion → the rep writes → the owner or manager validates | F20.7 | DESIGNED |
| 3 | AI-suggested deal updates: next steps from this and last week's calls, accepted or not | F20.4 | DESIGNED |
| 3 | Deal brief: what's happened, the risks, what's next, from all its calls, cited | F20.3 Briefs | DESIGNED |
| 4 | Win/loss: rate, and with vs without each tracker, competitor, contact count, call count, size; ≥100 closed deals (R6); each bar opens its deals; the math as CSV | F20.10 | DESIGNED |
| 4 | Deal drivers: per rep, the share of open deals with each warning; now / 30 / 90 days | F20.11 | DESIGNED |
| 4 | Account activity level, nightly | F21.4 | DESIGNED |
| 5 | Ask Anything over a deal or account (all its calls, notes and events), cited | #14, F13.8 | DESIGNED (extends `ask`, `ask-pipeline`) |
| 6 | Forecast board: per rep and manager rows; submission / metric / target columns | F22.1, F22.2 | DESIGNED |
| 6 | Submit with a note; the deals behind each cell | F22.3 | DESIGNED |
| 6 | Weekly snapshot; category movement; accuracy (green 85–115%) | F22.5–F22.7 | DESIGNED |
| 6 | Due day and reminder (in-app) | F22.4 | DESIGNED |
| 7 | Team revenue target per quarter on the forecast board (a manager sets their team's; the team row shows progress) | F23.4 | DESIGNED (founder picker 2026-11-27) |
| — | Likelihood score, revenue predictor, red flag email, CRM write-back, splits | F20.9 F22.8 F20.5 F20.2 F20.12 | PROPOSAL (00, deliberately not built) |
