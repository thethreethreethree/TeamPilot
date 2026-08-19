# Phase 3 — Build

## Built
| path | what | clause |
|------|------|--------|
| `src/lib/schedule/authority.ts` | `evaluateChange(change, ctx) → Verdict` — the ONE authority. Composes Phase-2 predicates + state-dependent checks (double-booking, approved-time-off overlap, hours cap) into an explicit Verdict{approvable, autoApprovable, violations, affectedShifts, reason}. Coverage gaps are `overridable:true` (block-by-default, manager may override); ineligible/double-booked/time-off-conflict/over-hours are `overridable:false` (absolute). Zero violations → autoApprovable. | A40, §2.2, §5, §2 |
| `src/lib/schedule/__tests__/authority.test.ts` | 8 drift-guard tests — BOTH branches of every term: auto-approve zero-impact, overridable coverage gap (approvable, not auto), absolute conflicts (ineligible/double-book/time-off/over-hours block), requested≠approved time-off, absolute-dominates-overridable. | A40, A30 |

## A40 single-source proof
`grep meetsCoverage|isEligible|withinLimits` → called ONLY inside `authority.ts` (+ constraints.test.ts). No
consumer re-derives the decision. The one other hit is a comment in types.ts. The verdict is the single source.

## Features (reachability inventory)

### the decision authority
`evaluateChange` — the single place the coverage/eligibility decision is computed and returned as a Verdict.
- write-path: EXISTS — the caller assembles an EvalContext (derived ScheduleState from Phase 1 + roster rows from Phase 2) and passes a proposed Change; a human proposes the change (time-off / assign / unassign / swap). human_can_set: true.
- read-path: EXISTS at the library altitude — the returned Verdict is consumed by Phase 4 (LLM proposal) + Phase 5 (the manager review queue shows verdict + gaps). Proven by authority.test.ts (8 tests). human_can_see: true (via those consumers).

## Step 7 — Reachability (A31), honest note
Phase 3 is pure layer-1 logic (no surface). The authority is reachable/proven at the library altitude (tests +
the single-source grep). Its runtime consumers (Phase 4 proposal, Phase 5 review UI) are the next phases —
disclosed, not hidden. No claim of an end-user surface in Phase 3.
