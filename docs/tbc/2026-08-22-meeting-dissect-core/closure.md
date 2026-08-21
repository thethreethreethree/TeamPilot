# CLOSURE — Meeting post-meeting Dissect measurement core

## What shipped
The §3.5 measurement core for the post-meeting Dissect: a prompt that reads a meeting's diarized transcript and
extracts CONSEQUENCES (decisions / owned-actions / open-items / effectiveness), a pure silent-safe parse, and an
INV22-safe generation function reusing `dissectCoachV5`. It measures what the meeting produced and never sees the
cues, so it cannot grade agreement (the forbidden metric). New strategy-dir files only; full `npm run check` exit
0 (3578 tests); no sales/server change.

## The un-named reliance
- **The founder's §3.5 sign-off on WHICH consequences.** This is a PROPOSED default (decisions / owned-actions /
  open-items / effectiveness). It's built + flagged so the founder can adjust the set, per the constitution's
  build-a-default-don't-offload discipline — not presented as the final word.
- **The diarized re-transcription existing.** The dissect consumes speaker-labeled turns; producing them
  (re-transcribe the durable audio with diarization) is the next increment's job.
- **Prompt quality is device/eval-confirmed.** The parse is unit-tested; whether the prompt extracts the right
  consequences from a real transcript needs a live-model eval when the wiring runs.

## Open (next increments)
1. Re-transcribe the durable meeting audio with diarization (reuse the sales retranscribe + autoSpeakerAssign).
2. A trigger (on-view or cron) → `generateMeetingDissect` → store as an append-only event.
3. A post-meeting review UI + a per-team improvement-TREND aggregate (no control baseline — audit finding).
4. RLS: the future review read-path must decide owner-vs-company visibility for the dissect (audit Layer-3 flag).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "proposed-measurement-set",
    "item": "The measured consequence set (decisions / owned-actions / open-items / effectiveness) is the agent's proposed default, not a founder-ratified spec.",
    "why_skipped": "The constitution says build a defensible default + propose it, don't offload to 'founder decides'; this set is directly the §3.5 named outputs of a productive meeting, so it is defensible, and it is flagged for adjustment rather than presented as final.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T00:56:00+08:00",
    "outcome": "Examined against §3.5: the set measures downstream CONSEQUENCE (what the meeting produced) and explicitly excludes the cues, so it cannot become an agreement-metric even if the founder adjusts the specific fields. The shape (consequence, not agreement) is the load-bearing part and is correct; the exact fields are cheaply adjustable at the prompt+parse+type in one place. Surfaced in the founder action queue for sign-off."
  },
  {
    "id": "prompt-quality-uneval",
    "item": "The dissect prompt's extraction quality on a real transcript is not evaluated (no live-model eval headless).",
    "why_skipped": "Same standing limit as every LLM prompt in this codebase — unit tests cover the parse + plumbing; prompt quality is confirmed on a real run.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
