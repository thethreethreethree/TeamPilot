# CLOSURE — auto-recover one-sided transcript

## What shipped
A one-sided (customer-missing) session — the founder's 6-minute "Knute roleplay" with a blank read — now
recovers automatically. On opening the After-Pitch, the page detects the capture gap (talk_ratio caveat) and,
if audio was saved, fires `/auto-recover`: the server claims an at-most-once marker, re-diarizes the saved
audio cleanly, auto-assigns the agent cluster (declining rather than guessing when unsure), replaces the broken
transcript, and regenerates. The rep sees the read appear, not a blank. Two same-day defects surfaced by the
adversarial review are remediated alongside (delete-guard on both overwrite paths; the recovery affordance is
now direction-based, not a mis-calibrated scores-length gate).

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Files scanned 780 · Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness (advisory stale line-ranges only)
Test Files 411 passed | 1 skipped (412); Tests 2848 passed | 15 skipped (2863)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "A transient STT/download failure consumes the auto_recover_attempted_at marker, so automatic retry won't re-fire for that session.", "why_skipped": "The manual one-tap recovery card + the upload path remain the always-available escape hatch, so no session is stranded — a bounded, honest cap on automatic cost.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T00:55:00Z", "outcome": "Accepted — documented in the migration + endpoint comments." },
  { "id": "R2", "item": "Auto-assignment can DECLINE (ambiguous / single-cluster) on a genuinely hard recording; the rep then taps manually.", "why_skipped": "Declining is the correct §3.4 behavior — a wrong confident label corrupts the exact record we're recovering. The fallback card is one tap.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T00:55:30Z", "outcome": "By design; the decline paths are tested." },
  { "id": "R3", "item": "The separate LLM reasoning-starvation ceiling (finish_reason:\"length\") is real but was NOT the cause here and is not addressed by this build.", "why_skipped": "Founder chose to confirm it via production logs first; the evidence (talk/listen '—') points to capture, not starvation.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T00:56:00Z", "outcome": "Tracked separately; confirm via the [deepseek] finish_reason log signature." }
]
```

## Un-named reliance
- The overwrite precondition relies on "talk_ratio caveat ⟺ the transcript is one-sided in the customer-missing
  direction". True because `computeTalkRatio` sets `caveat` exactly when `custW===0 && repW>0` (salesScore.ts).
  If that condition changed, the auto-recover precondition would need to follow it.
- Auto-assignment relies on "the live agent turns are ground truth for cross-match" in the customer-missing
  case. True because that side WAS captured (it produced the agent turns); if the agent side were also
  mislabeled the cross-match would weaken and the code correctly DECLINES rather than guess.

## Status
Complete once the gate shows exit 0. The founder's one-sided session recovers automatically; the manual card
remains as the fallback for the rare undecidable recording.
