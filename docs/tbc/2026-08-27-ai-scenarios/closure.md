# CLOSURE — AI-written practice scenarios (pending item 2)

## What shipped
The second pending optional. When a rep taps Practice on a focus, the AI now writes a concrete, realistic prospect
scenario tailored to that skill — who's at the door, their mood, what just happened — shown on the setup screen with a
"New scenario" button to regenerate. The rep drills the skill in a believable situation instead of a generic persona.
Grounded in the company's own market (corpus); it never names the skill, so the prospect stays in character.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). parsePracticeScenario unit-locked (5); typecheck clean; the route is
auth+company gated, rate-limited, CONVERSATION_IS_DATA fenced, and exports maxDuration (invariant-audit LLM rules).

## The un-named reliance
- **Generation is best-effort; a null scenario falls back to the plain focus seed.** So a slow/failed generation never
  blocks practice — the rep just gets the generic-but-focus-seeded setup, which already works.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Scenarios are generated fresh each time and not saved; a rep can't revisit a specific past scenario.",
    "why_skipped": "Consistent with the roleplay's deliberate stateless design (practice is ephemeral). Saving scenarios is an additive slice, not a correctness gap; regenerate covers 'give me a different one'.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T06:08:00+08:00",
    "outcome": "OPENED + bounded: the tailored scenario delivers the value now; persistence is additive, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "Two pending items remain (a coaching-materials library, brief scheduling).",
    "why_skipped": "Built in order; these are the next slices in the same 'build the rest' pass.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```
