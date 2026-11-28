# 00 — Open decisions (READ FIRST)

The build doesn't make up an answer to any of these. Each one has a stand-in today: either today's behaviour, kept on purpose, or a rule that shows nothing until it has enough data. All the numbers live in `elostate-revenue/src/lib/revenue/`. To decide one, change it there, update this table, and add a row to the decisions log in `BUILD-PLAN/00-BRIEF.md`.

| # | Decision | What stands in for it today | Cost of changing later |
|---|---|---|---|
| R1 | Is a deal the existing prospect, or a new table? | **The prospect.** `remote_prospects` and its events become the deal, and the screen says "Deals". One pipeline, not two (§1.5). | Very high after Phase 2. Two deal tables would split every report. |
| R2 | CRM sync (Gong M29) | **None.** EloState's own tables are the record (teardown F29.9, no-CRM mode). "Send to CRM" (0330 webhook) stays. | High. Association rules, field mapping and write-back are a project of their own. Start only with the CRM a paying client uses. |
| R3 | Deal stages | Today: a status (open / won / lost) plus a free-text label. Phase 2 adds a **company stage list**, so "stalled in stage" has stages to count. Existing labels are kept as text and mapped by name where one matches. | Medium. Stage history before the list exists can't be counted per stage. |
| R4 | Warning thresholds | Gong's published defaults where they exist (no activity 14 days, ghosted 7). The rest are marked [ASSUMED] in `warnings.ts`. Each one is a company setting. | Low. They're settings, and warnings re-evaluate nightly. |
| R5 | Account activity level formula | Gong doesn't publish its formula. Ours is stated in `rules.ts`: four recency buckets weighted 1.0 to 0.4, each extra call worth half the one before, and only calls where the customer spoke. | Low. Recomputed nightly. |
| R6 | Minimum closed deals before win/loss shows | Gong's 100. Below that the page says how many more closed deals it needs (§3.2). | Low. One constant. |
| R7 | Email capture (Gong M4) | **None.** So there's no "red flag email" warning and no email on the account timeline. | High. It's an inbox integration with its own consent rules. |
| R8 | Deal likelihood score (Gong F20.9) | **Not built**, and the deal panel says why: Gong trains on years of closed deals. | Not built, so nothing to change. Revisit when a company has hundreds of closed deals in EloState. |
| R9 | Multiple owners and revenue splits (F20.12) | One owner per deal (today's `rep_id`). | Medium. Splits change every amount roll-up. |
| R10 | Which playbooks ship | MEDDICC, BANT, SPICED and a custom one. These are public sales methods; each letter's wording is ours. | Low. Templates are data. |
| R11 | Who may see an account | Whoever can see one of its deals or calls (RLS through the existing tree). Gong shows every account to everyone (F21.5, a weakness). | High after Phase 1 if loosened. Keep it tight. |
| R12 | Forecast (Gong M22): which boards, period, due day | Phase 8 onward. Stand-in: one board per company, quarterly, submissions by managers. Targets: DECIDED 2026-11-27 (founder picker) — per person and per team, quarterly revenue only (phase 7). | Medium. Snapshots taken under one layout can't be re-cut. |

## R1 — Deal = prospect
**Options.** (a) Extend `remote_prospects`. (b) A new `deals` table and a migration of prospects into it.
**What I did.** (a). It already has events, calls, tasks, close date, lead source, erasure and tree RLS. A second table would mean two pipelines and two erasure paths.
**Where it bites.** The new event kinds `account`, `stage_id` and `contact` are added to `remote_prospect_events.kind`.

## R2 — No CRM sync
**Where it bites.** Contacts and accounts are made in EloState, from calls and by hand. Each call's people link to contacts, either confirmed by a person or chosen when the call is linked to a deal.

## Deliberately not built

| What | Why it's interesting | Why it's left out |
|---|---|---|
| Deal likelihood score (F20.9) | Gong's headline AI | Needs hundreds of closed deals to train (R8) |
| AI Revenue Predictor (F22.8) | Forecast headline | Depends on F20.9 |
| Red flag email warning | One of Gong's 8 | No email capture (R7) |
| Inline CRM write-back (F20.2, F20.8) | Keeps the CRM current | No CRM sync (R2) |
| Account boards visible to all (F21.5) | Gong does it | It's a data-access weakness (R11) |

## R9 — DECIDED 2026-11-28 (founder picker: "Deal splits")

Several owners with revenue splits, built as phase 10: shares in whole percents (2–5 people, the rep always included),
set by the rep or a manager over them, attribution only — visibility stays the rep's tree. The one-owner stand-in above
is superseded for amounts; `rep_id` stays the deal's owner for access, agents and notifications.
