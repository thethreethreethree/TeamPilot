# Phase 4 (part 1) — Build

## Built
| path | what | clause |
|------|------|--------|
| `src/lib/schedule/resolution.ts` | `findResolutions(shiftId, ctx)` — the deterministic search for employees who could fill an understaffed shift, validated through evaluateChange (A40 single source, never re-derives eligibility), ranked by current hours ascending (fair load). | §2 (find a better room), A40, §5 (deterministic) |
| `src/lib/schedule/__tests__/resolution.test.ts` | 6 tests — fair-load ranking, exclude already-assigned/double-booked/on-time-off/inactive/over-hours, honest empty result. | A30 |

## Features (reachability inventory)

### resolution search
`findResolutions` — given an understaffed shift, the candidates who could fill it.
- write-path: EXISTS — the caller passes the shiftId + EvalContext (state + roster). The gap that triggers a search comes from the authority's Verdict (a human's change created it). human_can_set: true.
- read-path: EXISTS at the library altitude (tested); the runtime consumer is the LLM proposal (Phase 4 step 3) + the Phase-5 review UI, which show the ranked candidates to the manager. human_can_see: true (via those).

## Step 7 — Reachability (A31) honest note
Pure layer-1 logic; reachable/proven at the library altitude. Its consumer (the LLM proposal + Phase-5 review
UI) is the next work. NOT claimed as an end-user surface.

## Deferred (the LLM half of Phase 4 — a founder voice decision)
Steps 1 (NL parse) + 3 (proposal generation) reuse `llmCall` + the CONVERSATION_IS_DATA injection fence +
eventSchema validation, but the AI's VOICE (tone/approach of the impact explanation + proposal) is a §3.3
guide-don't-overtake decision — surfaced to the founder as a picker, not chosen autonomously.
