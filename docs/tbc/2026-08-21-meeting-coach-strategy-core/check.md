# CHECK — Meeting Coach strategy core

## Tests (41 passing, all under `src/lib/coach/strategy/`)
> +6 since the initial 35: `userMessageAttribution.test.ts` locks the A39 per-turn attribution invariant
> (`SPEAKER: text` carried into the prompt; UNKNOWN when unattributed) AND the newline-injection defense (a
> turn's text can't forge another speaker's line — `renderTurns.ts` `oneLine` folds newlines). Found by an
> adversarial self-review after reading A39.

- `salesStrategy.test.ts` (4) — drift-guard on the CoachingStrategy → generateLiveCue arg-name mapping
  (`stall`→`stalled`, `directive`→`guide_response`, `wearerId`→`agentId`, N-party speaker narrowing); malformed
  hint signals → undefined (never a guess); LiveCueResult → CueDecision (empty cue → null).
- `meeting/__tests__/parseMeetingCue.test.ts` (10) — valid cue; understanding gate (empty cue → silent, read
  preserved); malformed/non-object/non-JSON → silent; leaked SALES trigger (`close`/`objection`) normalizes
  away; importance default = medium; force honors any non-empty cue.
- `huddle/__tests__/parseHuddleCue.test.ts` (5) — huddle vocab; overrun/deep_dive; leaked MEETING trigger →
  none; malformed → silent; force.
- `__tests__/promptSafety.test.ts` (6) — both brains, both modes: carry the shared anti-injection fence; contain
  NO sales trigger tokens (`objection`/`buying_signal`) — plan §6 at the prompt layer; disclaim being a sales
  coach.
- `__tests__/strategyClasses.test.ts` (10, parameterized over Meeting+Huddle) — understanding gate (too little
  → silent, LLM NOT called); force bypasses the gate; `suppressed` verdict → silent WITHOUT parsing (A40); valid
  → parsed cue; LLM throw → silent (NEVER throws).

## Canonical gate
- `npx vitest run src/lib/coach/strategy` → 5 files, **35 passed**.
- `npx tsc --noEmit -p tsconfig.json` → **EXIT 0** (clean; nothing else in the repo broke).
- A prior full `npm run check` this session was green at 3503 tests before this module; this module is additive
  (new files + comment-only edits), so it cannot regress existing behavior. A full `npm run check` should be run
  before the eventual commit.

## Zero production impact
Every strategy file is NEW and imported by nothing in the live path. The Sales Coach live loop is byte-for-byte
unchanged (the seam is a PROPOSAL, unwired). The only existing-file edits are comment corrections.

## Not covered here (by design — HELD for founder)
- The concrete `CueLLM` binding (needs the control-gate/model decision) → so no live LLM/earpiece round-trip is
  exercised. The strategy classes are proven with a fake LLM only.
- Live wiring + the `coaching_sessions` mode migration + N-party attribution (Decision #1).
- Real-hardware earpiece delivery (the reuse-map Flag-1 truth) — founder device check.
