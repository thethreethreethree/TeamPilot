# CLOSURE — the dissect gate stops leaving a one-sided session ambiguous forever

The 9/2 partner meeting's "difference between pitch analyzed and session dissected unclear … the
algorithm for whether a session gets dissected is a known bug" is resolved in two seams:

1. **Logic** — `runAndStoreDissect` now emits a `coach.dissect_attempted` backoff marker for the
   0-agent-turn (one-sided) case, closing the sibling of the loop the 2026-08-14 cost-loop fix left open.
   The session stops being re-selected by the backfill forever, and the "Generate missing" count can reach 0.
2. **Surface** — the sessions list carries `captureIssue` derived from that marker's `reason`, and renders an
   honest "One-sided" badge, so an absent Dissect badge reads as a capture problem the manager can act on
   (re-record / re-label), not as broken or still-processing.

## What this build does NOT do (un-named-reliance half)
- It does NOT remove the underlying split-gate (dissect gates on agent turns; moments on any speaker). That
  divergence is the deeper root and the founder chose the targeted fix over the structural unification
  (AMD-010, one capture-completeness verdict). If analyzed-vs-dissected confusion recurs on TWO-sided calls,
  that unification is the follow-up.
- It does NOT surface the one-sided status on the session DETAIL page — only the list (the manager surface the
  meeting named). The after-pitch page already carries its own empty-state cards for the customer-missing case.
- It relies on `dissectBackfill` reading `coach.dissect_attempted` by KIND only; if a future consumer starts
  branching on `reason`, both reasons (`no_signal`, `no_agent_turns`) must be handled.

## Residual (A36 — read from the TOP of the confidence ranking)
```json
[
  { "id": "R1-existing-sessions-heal",
    "item": "Whether EXISTING one-sided sessions (already in the DB with no marker, processed before this fix) get the new marker + 'One-sided' status, or only NEW sessions do.",
    "why_skipped": "Assumed the fix was forward-only and existing stuck sessions would need a data migration — the thing I was most sure didn't block shipping.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-09T13:35:00+08:00",
    "outcome": "OPENED and it was worth opening. generateSessionArtifacts.ts:43 calls the fixed runAndStoreDissect, and dissectBackfill re-selects every un-dissected session with content every run. So on the NEXT backfill pass each existing one-sided session hits the 0-agent branch, emits coach.dissect_attempted reason no_agent_turns, backs off, and gains captureIssue 'one-sided' in the list. Existing sessions SELF-HEAL — no migration needed. This is a stronger result than the fix as filed implied." },
  { "id": "R2-detail-page-status",
    "item": "The one-sided status shows only on the sessions LIST, not the session DETAIL page.",
    "why_skipped": "The list is the manager surface the 9/2 meeting named, and the after-pitch page already carries empty-state cards for capture gaps.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null },
  { "id": "R3-split-gate-unification",
    "item": "The underlying split-gate (dissect on agent-turns vs moments on any-speaker) is left in place, so 'analyzed' and 'dissected' can still diverge on other capture shapes.",
    "why_skipped": "Founder chose the targeted fix over the AMD-010 structural unification; the unification is a high-blast-radius refactor of the core pipeline.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null }
]
```

## Verification
See check.md — `npm run check` run whole with its pasted output and exit code, the emission + derivation
gates mutation-checked (reverting the one-line branch fails the named test), plus a visual read of the
rendered "One-sided" badge state.
