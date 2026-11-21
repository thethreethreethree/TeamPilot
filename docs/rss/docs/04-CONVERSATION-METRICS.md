# 04 — Conversation metrics and scoring (the measured layer)

Everything a remote session gets measured on, defined once. The code is
`src/lib/coach/remote/stats.ts` and `rubric.ts`. Where this file and the code disagree, the code
and its tests are right; fix this file.

## Interaction stats (new, Phase 2)

Input: timed transcript segments, `{speaker: rep | customer | unknown, startMs, endMs, text}`, from
the live transcript (versioned, 0269; speaker clusters, 0270; rep identified by voice enrollment).

| Stat | Definition | Source of the definition | Null when |
|---|---|---|---|
| Talk ratio (time) | Rep speech time ÷ (rep + customer speech time). Unknown speech excluded. | Gong F10.1 [OBSERVED] | No known speech |
| Longest monologue | Longest run of rep segments with no other speaker in between. Pauses don't break it. | Gong F10.2 | never (0) |
| Longest customer story | The same, for the customer | Gong F10.3 | never (0) |
| Interactivity | Speaker switches per 5-minute block, averaged, capped at 10. An utterance ≤ 1 s isn't a switch. | Gong F10.4; the 1 s is **[ASSUMED]** (D19) | Only one side spoke |
| Patience | Median gap between the customer finishing and the rep starting | Gong F10.5 | Rep never followed the customer |
| Rep questions per hour | Rep segments that are questions ÷ session span × 1 h. A question ends in "?" or starts with an interrogative word. | Gong F10.6; heuristic family of `salesScore.ts:79` [OBSERVED] | Zero-length session |

**Today's stats are kept.** The word-based talk/listen ratio and the "6 of 20 turns" question share
(`salesScore.ts:79, :114`) stay where they are. The session page shows both until you choose one.

### Benchmarks are not targets

Gong publishes B2B benchmarks: rep talk ~43%, monologue ≤ 2:30, interactivity ≥ 5, patience
0.6–1.0 s, ≥ 18 questions/hour (teardown M10). **None of them is used as a target, band or colour
here.** Phone and video norms for ELOSTATE's clients have to come from ELOSTATE's own sessions,
once enough exist. Until then, stats are shown as plain numbers next to the rep's own average.

## Scoring (existing engine, extended)

[OBSERVED, from the comparison's evidence]

- One rubric in code: AT&T Fiber, 30 elements graded **hit = 1 · partial = 0.5 · missed = 0** ×
  fixed points; 13 bonuses; 5 violations (`rubric.ts:30, :98`).
- Section weights sum to 100: 12 / 16 / 14 / 15 / 8 / 35. A unit test checks this on every commit
  (`rubric.test.ts:28`).
- Score = base + min(bonus, 30) − violations, floored at 0, on a 0–130 scale (`scorePitch.ts:123`).
  The model grades; the code does the maths. To qualify, a score needs 40 base plus Discovery
  (`:246`).
- Objection handling is skipped when there's no objection, and the rest of Delivery is rescaled from
  27 to 35 (`scorePitch.ts:169`).
- Points: the after-pitch dimension mean × 10 (0–100), banked once per session
  (`points.ts:24`, `bankPoints.ts:23`).

**RSS changes** (code in `rubric.ts`):

1. **Rubric per channel.** A company can hold one active rubric per channel (`any · door · phone ·
   video`). A phone or video session scored by a non-remote rubric carries the caveat *"Scored with
   the company rubric: no phone rubric yet (decision D6)"*. The UI must print it on the score panel.
2. **N/A per element.** Generalises today's objection-handling rule. Points from N/A elements are
   spread over the rest of the section: `earned ÷ applicable points × section total`.
3. **Scoring floor.** Today: at least one rep segment (D5). Below the floor → `not_scored` with
   reason `BELOW_SCORING_FLOOR`, so no score and no points.
4. **Provenance.** Every score records model, prompt version, rubric version, and whether it was
   automatic or a manager re-score.

## Keyword trackers (new, Phase 3)

Whole-word and case-insensitive. Each phrase matches at most once per segment. A tracker can be
limited to the rep's side, the customer's side, or either. Each phrase needs at least 2 characters,
and a tracker 1–200 phrases. Hits record the segment start time, so the existing play-at-timestamp
chips work unchanged. Trackers are deactivated, never deleted, so past hits stay explainable.

## Failure and not-scored reasons (closed list, Phase 1)

`NO_AUDIO · NO_SPEECH · ONE_SIDED_CAPTURE · TOO_LARGE · TRANSCRIBE_TIMEOUT · AI_UNAVAILABLE ·
AI_QUOTA · BELOW_SCORING_FLOOR · NOT_A_SALES_CALL`. [INFERRED] from today's curated messages
(`pitchFailureMessage.ts:16`) and capture-gap detection (`captureGap.ts:30`), turned into a list
that can be reported on. The SQL check (0272) and `state.ts` must change together.
