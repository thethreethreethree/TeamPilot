# CLOSURE — STT-capture instrumentation

## What shipped
Founder reported "some agents get no after-pitch feedback" and suspected a session cap. Record-check first:
there is NO session/transcript cap. The cause is the documented STT reliability failure (ElevenLabs Scribe
realtime "sometimes captures zero turns") → 0 agent turns → EMPTY review. Founder chose "instrument first."
Built: (1) a per-session `[stt-capture]` log at the feedback point; (2) an extension to `capture-health` that
measures the TRUE no-feedback population (0 agent turns = empty OR one-sided) with a per-agent breakdown; (3) the
settings UI to surface it. Along the way, fixed a real undercount: capture-health had counted one-sided captures
as "fine," under-reporting the cost.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
Test Files 407 passed | 1 skipped (408); Tests 2813 passed | 15 skipped (2828)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "byAgent returns agent_id (UUID), not names — the UI shows a short id. Resolving names needs a profiles join (which complicates the route's mocked test).", "why_skipped": "The instrumentation's core value (accurate counts + per-agent RATES) is delivered; names are a UX polish. A manager can cross-ref ids, or a follow-up adds a name lookup.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T23:52:00Z", "outcome": "Flagged — quick follow-up if the founder wants names in the card." },
  { "id": "R2", "item": "The log confirms the OUTCOME (0 agent turns in the saved transcript) but can't alone distinguish 'Scribe never captured the agent' from 'captured but not saved'. Distinguishing needs client-side capture telemetry.", "why_skipped": "Server-side log is the fast, collectable first step the founder chose; the managed-STT experiment is the next step and will A/B the zero-turns rate directly.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T23:52:30Z", "outcome": "Next step: managed-STT reliability experiment against this baseline." }
]
```

## Un-named reliance
- The no-feedback count relies on `MIN_AGENT_SEGMENTS === 1` being the review/dissect/score EMPTY gate — so
  "has ≥1 agent segment" ⟺ "feedback is possible." That equivalence is the same one the shipped drift guard
  (`minAgentSegments.sync.test.ts`) protects across the engines. If that threshold changed, the capture-health
  definition of "no feedback" would need to follow it.

## Status
Complete once the gate shows exit 0. This is the "instrument first" step; the managed-STT reliability experiment
runs next, measured against the baseline this produces.
