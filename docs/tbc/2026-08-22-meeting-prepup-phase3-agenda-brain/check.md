# CHECK — Prep-up Phase 3: the agenda-aware brain

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  558 passed | 1 skipped (559)
      Tests  3665 passed | 15 skipped (3680)
EXIT: 0
```

All gates exit 0. Brain/route/data-layer change; no schema change; sales + prep-less meetings unaffected.

## What the tests prove
- `parseMeetingCue` parses `covered` → coveredTopicIds on BOTH a cue and a silent pass; dedupes + drops
  non-strings; absent when not provided. `uncovered_topic` is a deliverable meeting trigger.
- `buildMeetingCueUserMessage` renders the goal + topic ids + coverage marks + doc context WHEN an agenda is
  present, and omits the whole block when absent (prep-less meeting — no regression).
- Cue route: passes the agenda into the brain, and PERSISTS the coverage the brain reports (t1 flips covered, t2
  stays; no double-write when unchanged). The existing meeting-cue route tests still pass.

## Findings
**No findings.** One LLM call does cue + coverage; coverage is parsed once at the shared chokepoint (§2.2) and
grounded in the carried topic ids (§3.4/A39); additive with no non-agenda impact.
