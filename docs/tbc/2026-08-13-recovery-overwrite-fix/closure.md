# CLOSURE — recovery overwrite fix

## What shipped
Self-verifying the blank-read recovery stopgap I shipped earlier (1728ee57), I found it was BROKEN: the
re-transcribe save (`label-transcript`) 409'd on any existing transcript, but the affordance only renders for
one-sided sessions — which have segments — so it always failed. I surfaced this to the founder honestly; they
chose to fix it. `label-transcript` now 409s only when the existing transcript is CANONICAL (has agent turns);
a 0-agent-turns transcript (broken read, no "Your read" value) is deleted (`deleteSessionTranscriptSegments`,
a new narrow, gated append-only exception) and replaced by the re-diarized one. Now the stopgap actually
recovers one-sided sessions.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
Test Files 407 passed | 1 skipped (408); Tests 2814 passed | 15 skipped (2829)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "The delete introduces a small TOCTOU window (read 0-agent → delete → insert). Two concurrent recovery re-transcribes on ONE session could interleave.", "why_skipped": "Recovery is a manual, single-agent action on a session the rep owns; the unique(session_id, seq) constraint still prevents a doubled transcript, and whichever completes last yields a valid one. Same posture as the fast-fail check it replaces.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-13T23:56:30Z", "outcome": "Accepted — a serialized delete+insert (RPC/transaction) is the hardening if this ever races in practice." },
  { "id": "R2", "item": "For a TRUE one-sided recording (the audio itself lacks the agent), re-transcribe re-diarizes but still yields 0 agent turns → the read stays blank + the affordance shows again.", "why_skipped": "The audio usually holds both voices (room mic), so this is the minority; the recovery is harmless (no worse than before), just doesn't recover that subset.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T23:57:00Z", "outcome": "The permanent fix + the capture-health `customerLabeled` count quantify this subset." }
]
```

## Un-named reliance
- The guard relies on "has an agent segment ⟺ the transcript is canonical (produces a real read)". True because
  the review/dissect engines short-circuit to EMPTY below MIN_AGENT_SEGMENTS (=1) — the same equivalence the
  shipped `minAgentSegments.sync.test.ts` drift guard protects. If that threshold changed, this canonical
  definition would need to follow it.

## Status
Complete once the gate shows exit 0. The recovery stopgap now works as described — an honest fix to a feature I
shipped broken.
