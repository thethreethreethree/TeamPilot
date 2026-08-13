# CLOSURE — after-pitch heal convergence fix

## What shipped
An adversarial review spawned to independently check my own three session fixes (F1 read-heal, F2 stream log,
connect-panel refactor) found the F2 and connect-panel changes SOUND and confirmed a real regression in the F1
read-heal: the narrative-heal keyed on `!narrative.hasSignal`, but the after-pitch composite has four terms and
two of them (`moments`, `cueLoop`) fire independently of agent turns. A one-sided / customer-only recording
(rep mic not captured → 0 agent turns) therefore stored `{hasSignal:true, narrative:{hasSignal:false}}`, and
the heal re-fired a full 4-engine generation on EVERY mount, never converging — unbounded LLM spend and a read
the heal falsely promised to fill. One-sided recordings are realistic (mobile agents). Fixed by gating the
narrative-heal on `scores.length > 0` (an exact proxy for "agent turns present" → the recoverable case only).
The starved case the heal was built for still converges; the F2 and connect-panel changes needed no change.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
Test Files 406 passed | 1 skipped (407); Tests 2810 passed | 15 skipped (2825)
```
The one-sided-recording case is now a detection test (asserts no-heal post-fix AND that the pre-fix
narrative-only trigger would have looped).

## Residual (A36)
```json
[
  { "id": "R1", "item": "The tone-law 'growth but no strengths' case and persistent F3 corpus starvation (agent turns → scores present, narrative repeatedly blank) still re-heal per visit.", "why_skipped": "Rare + semi-desirable (retry toward a tone-law-valid read) + bounded per-visit + tied to founder-gated corpus-trim. A durable once-per-session heal marker would close it but adds a browser-API-throws surface for a rare case.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T23:35:00Z", "outcome": "Flagged in docs/SESSION-FINDINGS-2026-08-13.md; deferred pending the corpus-trim decision." },
  { "id": "R2", "item": "The React auto-heal effect is not node-exercisable; only the pure predicate is unit-tested. The effect is a thin call over it.", "why_skipped": "No React harness in the sandbox (standing posture). The DECISION is a pure tested helper.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T23:35:30Z", "outcome": "Opened + assessed: predicate detection-tested; live-confirm on the founder's next revisit." }
]
```

## Un-named reliance
- The fix relies on `scores.length > 0` being an EXACT proxy for "agent turns present" — verified: `salesScore`
  returns EMPTY iff `agentSegments < MIN_AGENT_SEGMENTS` (salesScore.ts:181-182), the SAME condition under
  which `salesReview` short-circuits to EMPTY_REVIEW (salesReview.ts:67-70). If either engine's agent-turn gate
  changed independently, the proxy would drift — they must stay in lockstep (both key on MIN_AGENT_SEGMENTS).

## Status
Complete once the gate output above shows exit 0. The adversarial-review-of-my-own-fixes pattern paid off
again: it caught a HIGH regression I introduced, from a term of the composite I hadn't considered.
