# 08 — "One-sided" capture status on the sessions list

**What it is.** When a session was recorded with only ONE side captured (the rep's own audio missing — 0 agent
turns), the coach can produce an After-Pitch summary from the customer side but NOT a full "read" (dissect). It
used to just look broken (an absent Dissect badge, no reason) AND the backfill re-processed it forever. Now the
session shows an honest **"One-sided"** status, so a missing read reads as a capture problem to fix (re-record /
re-label), not a bug. (9/2 meeting "known dissect bug".)

**App work: render one new field on the sessions list.**

## Web source of truth
- Marker: `src/lib/coach/v5/salesDissect.ts` — `runAndStoreDissect` now emits a `coach.dissect_attempted` event
  for EVERY no-signal outcome, with `reason` = `"no_signal"` (agent present, LLM ran, nothing) vs
  `"no_agent_turns"` (one-sided — the rep's side wasn't captured). This also stops the backfill re-selecting the
  stuck session forever.
- List field: `src/app/api/coach/sales-session/list/route.ts` — each row now carries
  `captureIssue: "one-sided" | null`, set to `"one-sided"` when the latest `coach.dissect_attempted` reason is
  `no_agent_turns` AND the session has no dissect (a later dissect clears it).
- Web UI: `src/app/dashboard/sales-coach/sessions/page.tsx` — an amber **"One-sided"** badge (MicOff icon) beside
  the other session badges, with a tooltip: "The rep's side wasn't captured on this recording, so the full read
  (Dissect) can't be generated. Re-record or re-label the speakers to recover it." Theme-aware amber (amber-600
  on light, amber-300 on dark).

## Data contract
The sessions-list rows now include `captureIssue: "one-sided" | null` alongside `hasDissect`, `hasSummary`, etc.

## UI to build (native)
- On the sessions list, when `captureIssue === "one-sided" && !hasDissect`, show an amber **"One-sided"** chip
  (a mic-off icon), with the same explanatory copy. It reads as "a capture problem to fix", not "broken" and not
  "still processing".

## Note (relevant to the app as a capture client)
A one-sided session happens when the rep's audio isn't captured/attributed. The app's capture pipeline should aim
to get BOTH sides; when it can't, this status is the honest surface. Ties to doc 04 (the app must attribute
speakers + stamp timing) — better native capture reduces how often "One-sided" appears.
