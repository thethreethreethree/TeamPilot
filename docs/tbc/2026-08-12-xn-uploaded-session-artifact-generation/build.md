# BUILD — uploaded-recording sessions generate the post-call summary

## Feature inventory

### Uploaded-recording sessions generate the post-call artifact set (`/label-transcript` → `generateSessionArtifacts`)
- write-path: after `/api/coach/sales-session/[id]/label-transcript` appends the labeled transcript (the
  uploaded-recording flow's transcript source), it now schedules `generateSessionArtifacts()` via `after()` —
  the SAME five engines (`runAndStoreDissect/Summary/Moments/Pivot/Intel`) that `/finalize` runs for a LIVE
  session — writing the `coach.session_{summary,dissect,pivot,moments,intel}_generated` append-only events.
  Gated on `appended > 0` (only a fresh label, since the 409 guard blocks re-labels) AND a non-null
  `companyId` (never runs ungated). `maxDuration = 60` keeps the function alive for the post-response work.
- read-path: `GET /api/coach/sales-session/[id]/summarize` reads those stored events back (unchanged); the
  session `[id]` page's Conversation-summary section, the After-Pitch "What happened", and the Sessions-list
  "Summary" badge now populate for uploaded calls exactly as they already did for live ones. Reachable from
  any uploaded-recording session; the generation trigger is locked by `label-transcript/__tests__/route.test.ts`.

## Files changed
- **src/lib/coach/v5/generateSessionArtifacts.ts** (NEW) — the shared five-engine post-call generation,
  extracted verbatim from `/finalize` (A16 drift-guard). Each engine is bounded by `withEngineTimeout` +
  its own `.catch(fallback)`; uses the admin client internally so it is safe to run outside the request scope.
- **src/app/api/coach/sales-session/[id]/finalize/route.ts** — replaced the inline five-engine block with a
  call to `generateSessionArtifacts` (behavior-identical: same engines, timeouts, fallbacks, return shape).
  Dropped the now-unused `runAndStore*` + `withEngineTimeout` imports.
- **src/app/api/coach/sales-session/[id]/label-transcript/route.ts** — after appending the labeled transcript,
  read the full transcript (RLS user client, within request scope) and schedule `generateSessionArtifacts` via
  `after()`. Added `maxDuration = 60`; imports `after`, `getCurrentCompanyId`, `generateSessionArtifacts`.
- **src/app/api/coach/sales-session/[id]/label-transcript/__tests__/route.test.ts** — 2 new tests: generation
  fires with the right args from the labeled transcript; and does NOT fire when nothing was appended (409) or
  when there is no company context.

## Why after() and not await (UX)
`await`-ing the ~10–40s generation would hold the rep on a spinner during the "which voice is you?" → labeling
step (the founder explicitly flagged "never look frozen", e1f9716b). `after()` returns the label response
immediately; the rep taps through session-naming into the After-Pitch (which auto-generates its own "Your
read" from the transcript) while the five engines finish server-side. This mirrors the live flow, where
`/finalize`'s generation also happens around session-end rather than blocking the user.

## What did NOT change (holistic — §1.5.1)
- Live coaching flow (`useLiveCoaching` → `/finalize`) — same behavior; finalize just calls the shared helper
  now. Its owner-only gate + tests are unchanged.
- The manual `/summarize` POST (SessionCoachTools) and the dissect-backfill cron — untouched.
- Scope: only Sales Coach session routes + one sales-coach lib file (founder: "just for the SESSIONS module").
