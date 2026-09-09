# BUILD — the dissect gate stops leaving a one-sided session ambiguous forever

### The 0-agent-turn session now records WHY it wasn't dissected
- write-path: `src/lib/coach/v5/salesDissect.ts` — `runAndStoreDissect`'s no-signal branch changed from
  `else if (agentTurns >= MIN)` to `else`, so EVERY no-signal outcome emits a `coach.dissect_attempted`
  backoff marker. A `reason` payload distinguishes `no_signal` (agent turns present, the LLM ran and produced
  nothing) from `no_agent_turns` (0 agent turns, short-circuited before the LLM — the rep's side wasn't captured).
- read-path: `dissectBackfill` (reads by KIND) now BACKS OFF the one-sided session for 14 days instead of
  re-selecting it every pass forever, so the cap stops burning and the "Generate missing" count can reach 0.

### The sessions list explains an absent Dissect badge honestly
- write-path: `src/app/api/coach/sales-session/list/route.ts` — a new payload-bearing query reads the LATEST
  `coach.dissect_attempted` reason per session (separate from the payload-free badge query, mirroring the
  pivot/moments signal read); each row gains `captureIssue: "one-sided" | null`, set only when the latest
  reason is `no_agent_turns` AND the session has no dissect.
- read-path: `src/app/dashboard/sales-coach/sessions/page.tsx` renders an amber "One-sided" badge (MicOff)
  with a tooltip telling the manager to re-record or re-label speakers — so the absent Dissect badge reads as
  a capture problem, not "broken" and not "still processing" (the "pitch analyzed vs dissected unclear" bug).

### NOT a change to the engines' signal logic (the chosen altitude)
- write-path: the split-gate (`salesDissect.ts` agent-turns vs `salesMoments.ts` any-speaker) is UNCHANGED;
  only the marker seam and the list row shape changed.
- read-path: a two-sided call behaves exactly as before — no new "One-sided" label appears on it, because its
  reason is `no_signal` (or it has a dissect). The founder chose this targeted altitude over the structural
  unification (AMD-010); the follow-up is recorded in closure.md.

### The gate (A30)
- write-path: `src/lib/coach/v5/__tests__/runAndStoreDissect.emit.test.ts` — the 0-agent-turn test flipped
  from "emits NOTHING" to asserting `coach.dissect_attempted` reason `no_agent_turns`, plus a new test pinning
  `no_signal` for the agent-present case.
- read-path: `src/app/api/coach/sales-session/list/__tests__/route.test.ts` — three new tests pin the row
  derivation the UI consumes: no_agent_turns+no-dissect → "one-sided"; no_signal → null; a landed dissect
  clears it. Reverting the one-line branch fails these.

## Files
- `src/lib/coach/v5/salesDissect.ts`
- `src/app/api/coach/sales-session/list/route.ts`
- `src/app/dashboard/sales-coach/sessions/page.tsx`
- `src/lib/coach/v5/__tests__/runAndStoreDissect.emit.test.ts`
- `src/app/api/coach/sales-session/list/__tests__/route.test.ts`

## Ripple (§1.5)
- `coach.dissect_attempted` has ONE functional consumer — `dissectBackfill.ts:122`, which reads by KIND
  only. Broadening WHEN it is emitted extends the 14-day backoff to the 0-agent case (intended); the added
  `reason` payload is new data no existing reader depends on.
- Re-transcription / speaker re-label (`label-transcript`, `auto-recover`) regenerate via
  `generateSessionArtifacts` DIRECTLY, bypassing the backfill's backoff check — so a `no_agent_turns` marker
  never blocks a genuine recovery. A list-route test pins that a landed dissect clears the status.
- `events.kind` is free text (0004); `coach.dissect_attempted` is not a `signal_sources` kind (0005) — no
  derivation trigger, no schema change.
