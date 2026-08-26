# BUILD — Training-system post-ship audit fixes

### F1 — ground the per-rep focus in the prompt (was structurally empty)
- write-path: `teamTrainingBriefPrompt.ts` — `TeamTrainingBriefInput` gains `repSignals[{rep, topFocus}]`; the user
  message renders a "PER-REP SIGNAL" block; the system prompt now says repFocus must use those exact names + phrase
  that rep's own growth area. `teamTrainingBrief.ts` — groups the window's dissect rows by actor, takes each rep's
  top-frequency growth area (`rankByFrequency(aggregateDissectContent(actorRows).growth, 1)`), builds `repSignals`, and
  uses those names as BOTH the prompt input and the parse whitelist (`validRepNames`).
- read-path: the LLM now has real names + grounded signal, so `repFocus` populates and "One focus each" renders.

### F2 — 5xx must not downgrade a manager to the rep view
- write-path: `training/page.tsx` `load()` — ONLY `res.status === 403` falls back to `my-training`; any other non-ok
  (or null) calls `fail()`.
- read-path: a transient server error shows an error, not a silent wrong-role rep view.

### F3 — degraded must not hang on "Loading…"
- write-path: `training/page.tsx` — a shared `fail()` sets `error` AND `mode="error"` (new union member); every failure
  branch uses it.
- read-path: the error banner shows alone; "Loading…" clears.

### Practice Finding-1 — a fresh ?focus= launch starts clean
- write-path: `roleplay/page.tsx` — the recovery effect bails (and drops the stale copy) when `?focus=` is in the URL;
  the focus read clamps to 600 chars.
- read-path: clicking "Practice X" always opens a fresh, focus-seeded setup; no stale conversation scored against X.

### A30 guard
- write-path: `teamTrainingBrief.test.ts` — asserts `buildTeamBriefUserMessage` contains the repSignals' names (+ an
  honest "omit repFocus" line when there's no per-rep signal).
- read-path: the F1 regression (dropping names from the prompt) now fails a test.

## Files
- `src/lib/coach/v5/teamTrainingBriefPrompt.ts`, `src/lib/coach/v5/teamTrainingBrief.ts` — F1.
- `src/lib/coach/v5/__tests__/teamTrainingBrief.test.ts` — F1 guard (+2 tests).
- `src/app/dashboard/sales-coach/training/page.tsx` — F2 + F3.
- `src/app/dashboard/sales-coach/roleplay/page.tsx` — Practice Finding-1 + focus clamp.

## Ripple (§6 item 5)
No schema, no route, no LLM-caller change. The default (no-focus) roleplay path and the manager/rep data contracts are
unchanged. All four are behind existing guards; typecheck + the brief/roleplay tests pass.

## Honest limit
F1's grounding is each rep's TOP growth area (one per rep) — enough for a one-line focus; a richer multi-signal per-rep
brief is a later enhancement. Finding-1's fix drops an in-progress plain roleplay when a Practice link is clicked
(acceptable — the rep chose to start a focused practice).
