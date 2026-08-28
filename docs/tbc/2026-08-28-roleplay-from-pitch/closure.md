# CLOSURE — Role Play from a recorded pitch

## What shipped
A "Role play" button on the Pitch Performance drill-down (a completed pitch with a transcript). Clicking it opens
the existing roleplay with the CUSTOMER reconstructed from that pitch's recording — their persona and the exact
objections they raised — and the end review SCORED on the rep's weak spot from that pitch. The rep re-pitches the
same situation for repetition and measurable improvement (the founder's ask). Maximum reuse: the roleplay engine,
its scoring, and the honesty seam are unchanged; the feature is a new seed source only.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). The prompt's faithfulness/no-coaching/infer-speaker rules + the transcript
clamp + the null-fallback are unit-gated (+3 cases); the new LLM route inherits the invariant-audit contracts
(maxDuration, injection fence, auth gate, generic errors). The reconstruction QUALITY over a real pitch is founder
visual-verify.

## The un-named reliance
- **Reconstruction quality is an LLM judgement** — the stored pitch transcript is a non-diarized blob, so the model
  infers who said what (the same assumption the pitch analyzer makes). Whether it rebuilds the customer + objections
  faithfully is founder visual-verify on a real pitch; the prompt constrains it and a bad parse falls back to a
  plain roleplay, but I did not exercise it against a live recording.
- **The client seed + button render are founder visual-verify** — no jsdom harness for these client pages.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Reconstruction faithfulness not verified against a live recorded pitch (needs a real LLM call over a real transcript). If the non-diarized blob yields a weak persona, switching the doorlog worker to the diarized STT (transcribeSpeechDiarized, already used by the Live coach) would give clean rep/customer separation.",
    "why_skipped": "The wiring + honesty seam are gated; the LLM output over real data is founder visual-verify, not unit-testable here.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T11:45:00+08:00",
    "outcome": "OPEN — founder to try Role Play on a real pitch; escalate to diarized capture if the persona is thin."
  },
  {
    "id": "R2",
    "item": "Objection-metric history backfill still open (from the KPI work) — objections fills as sessions re-analyze; a forced LLM backfill would populate it now (founder cost decision).",
    "why_skipped": "Gating until re-analysis is correct §3.4 behavior; a bulk backfill is a cost decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T11:45:00+08:00",
    "outcome": "OPEN — offer a costed backfill if the founder wants objection numbers populated now."
  }
]
```
