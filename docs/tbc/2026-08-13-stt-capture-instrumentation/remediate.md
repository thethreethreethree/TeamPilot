# REMEDIATE — STT-capture instrumentation

## F1 — capture-health undercounted the no-feedback cost
Root cause: the 2026-08-12 capture-health counted a session "captured fine" if it had ANY transcript segment
(`withTranscript.has(id)`). But the review/dissect/score engines short-circuit to EMPTY when
`agentSegments.length < MIN_AGENT_SEGMENTS` (=1) — so a ONE-SIDED capture (customer segments present, the
agent's mic not captured → 0 agent turns) yields NO "Your read" yet was counted as a success. The reported
`failed`/`failureRate` therefore under-represented the true "no after-pitch feedback" population.

Remediation: key "captured" on an AGENT segment (`withAgentSegment`). Add:
- `noFeedback` = sessions with 0 agent turns (empty OR one-sided) — the true cost.
- `oneSided` = segments present but 0 agent turns (the missed class); `failed` kept as the legacy
  no-transcript-at-all count.
- `byAgent[]` = per-agent {ended, noFeedback, oneSided, empty, rate}, worst-first — so a manager can spot a
  device/mic capture problem by rep (the "find affected agents" the founder asked for before any STT swap).
Legacy fields + the paged/honest-count discipline preserved. Test updated to cover the split + per-agent.
class: silent-undercount. severity: medium. Fixed.

## Instrumentation (not a fix — added measurement)
`afterPitch.ts` emits a per-session `[stt-capture]` log at the feedback-generation point (session/context/turn
counts/empty/oneSided). Logging only. Confirms the STT-zero-turns hypothesis with real data before the
managed-STT reliability experiment, and identifies affected sessions (→ agent via join) in real time.

## Guardrail honored
No cap added to the session/transcript (founder-forbidden; none existed). The corpus-cap (authorized earlier) is
paused and NOT in this build — its helper `src/lib/llm/corpusBudget.ts` is unwired.
