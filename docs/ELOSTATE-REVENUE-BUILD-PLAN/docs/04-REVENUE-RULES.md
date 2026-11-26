# 04 — Revenue rules (the measured layer)

The code wins over this page: `elostate-revenue/src/lib/revenue/warnings.ts` and `rules.ts` (14 tests).

## Warnings (Gong F20.5)

**One authority (§2.2), found 2026-11-27 during Phase 1:** `src/lib/coach/remote/dealRisk.ts` already raises deal
warnings in the live Pipeline: no next call, a booked call date that passed, no call in 21 days (14 when new), an overdue
to-do, the customer cooling, a passed close date. Phase 3 adds the kinds below to **dealRisk.ts**. A second evaluator next
to it would drift. `warnings.ts` in the scaffold is the specification of those additions; only its `rankOf` is in the app
today (contacts' rank).
| Kind | Fires when | Default | Source |
|---|---|---|---|
| no_activity | no linked call for N days (counted from creation if none) | 14 | Gong 7/14/7 [OBSERVED] |
| ghosted | calls exist but the customer hasn't spoken in N days | 7 | Gong 4/7/4 [OBSERVED] |
| overdue | close date has passed | — | Gong [OBSERVED] |
| few_contacts | fewer than N contacts after M days open | 2, 14 | Gong 1–5 [ASSUMED values] |
| no_power | within N days of close, no director, VP or C-level contact active in N days, and ≥75% of titled contacts below that rank; never fires on unknown titles | 30 | Gong rule [OBSERVED], N [ASSUMED] |
| pricing_not_mentioned | within N days of close and price never came up (the pricing tracker or topic on a linked call) | 30 | Gong [OBSERVED], N [ASSUMED] |
| stalled | longer in a stage than that stage's limit; stages with no limit never stall | per stage | Gong [OBSERVED] |

Only open deals warn. Calendar days, as Gong.

## Activity level (F21.4) [ASSUMED formula, R5]
Score 0–100 over windows of 21, 90, 180 or 365 days. Each window is cut into four quarters weighted 1.0, 0.8, 0.6 and 0.4. Within a quarter, each extra two-way call adds half what the one before added. One two-way call in every quarter of the window scores 50.
- High: 50 or more
- Medium: 25–49
- Low: 1–24
- Inactive: 0

## Playbook notes (F20.7)
empty → ai_found → noted → validated. Validating needs a written note, from the owner or their manager. Editing a validated note sets it back to noted. Every AI suggestion cites the call lines it rests on, and a suggestion with no cited line is dropped (the same rule as briefs, `briefTemplates.parseAnswers`).

## Win/loss (F20.10)
Win rate = won ÷ (won + lost). Nothing is shown below 100 closed deals (R6). Each comparison side needs at least 10 deals, or it shows "too few".

## Account matching
Backfill links on `accountKey` only (case, accents, spaces and punctuation ignored). Legal suffixes are not stripped, because "Acme" and "Acme Inc" can be two companies; those near matches go to a person as suggestions (`looseKey`).
