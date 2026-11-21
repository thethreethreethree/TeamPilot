# BUILD - RSS Phases 1-3

### Phone as a channel (Phase 1 steps 1-2)

- **write-path:** `supabase/migrations/0275_rss_p1_capture.sql` (context check) ← `src/app/api/coach/sales-session/route.ts`
  (`z.enum(SALES_CONTEXTS)`) ← Phone buttons in `src/app/dashboard/sales-coach/page.tsx` and
  `src/components/sales-coach/StartSessionPanel.tsx`.
- **read-path:** `src/lib/coach/sessionContext.ts` → 8 prompts (`contextPromptLine`), `useLiveCoaching`
  (`micHearsRepOnly`), list/session/after-pitch pages (`CONTEXT_LABEL`), list filter (`isSalesContext`).

### Closed failure reasons (Phase 1 step 4)

- **write-path:** `recordSessionFailure` (`src/lib/coach/remote/session/failures.ts`) → `session_failures` (0275), from
  `scoreSession` (BELOW_SCORING_FLOOR, AI_QUOTA, AI_UNAVAILABLE) and upload-recording / sign (TOO_LARGE,
  NO_SPEECH, TRANSCRIBE_TIMEOUT, AI_UNAVAILABLE). Phone/video only.
- **read-path:** `src/app/api/coach/sales-session/[id]/stage/route.ts` → `remoteStage` (`src/lib/coach/remote/session/stage.ts`)
  → `src/components/sales-coach/StageChips.tsx` on `src/app/dashboard/sales-coach/[id]/page.tsx`.

### Segment end times and interaction stats (Phase 2 step 1)

- **write-path:** `transcribeWithDiarization` keeps each segment's end (`src/lib/care/voice/elevenlabs.ts`) →
  upload-recording / label-transcript / transcriptRecovery → `appendTranscriptSegment` / `replaceSessionTranscript`
  (`src/lib/data/salesCoach.ts`) → `ended_at` (`supabase/migrations/0277_rss_p2_interaction_stats.sql`).
  `storeInteractionStats` (`src/lib/coach/remote/interactionStats.ts`, from `generateSessionArtifacts`) →
  `session_interaction_stats`.
- **read-path:** `src/app/api/coach/remote/[id]/stats/route.ts` (`loadSessionTiming` + `computeInteractionStats` +
  `talkTimeLanes` from `src/lib/coach/remote/stats.ts`, the rep's 30-day averages, a signed audio URL) →
  `src/components/sales-coach/RemoteCallPanel.tsx` on the session page.

### Player, lanes, transcript search (Phase 2 steps 2-3)

- **write-path:** none.
- **read-path:** `RemoteCallPanel` (±10 s, speed, lanes, isolation) registers its seek with
  `src/app/dashboard/sales-coach/[id]/page.tsx`; `src/components/sales-coach/SessionTranscript.tsx` (search,
  tap-to-seek) and `TrackerHitChips` call it.

### D6 caveat (Phase 3 step 2, partial)

- **write-path:** none.
- **read-path:** `rubricFor(channel, CODE_RUBRIC_ROWS)` (`src/lib/coach/remote/rubric.ts`) → one line in
  `src/components/sales-coach/PitchScorePanel.tsx` for phone/video.

### Keyword trackers (Phase 3 step 3)

- **write-path:** `src/app/api/coach/remote/trackers/route.ts` (POST create, PATCH deactivate, POST scan) →
  `keyword_trackers`; `scanSessionTrackers` (`src/lib/coach/remote/trackerScan.ts`, from `generateSessionArtifacts`
  and the scan action) → `tracker_hits` (`supabase/migrations/0276_rss_p3_keyword_trackers.sql`).
- **read-path:** GET trackers → `src/components/sales-coach/KeywordTrackers.tsx` (Settings → Coaching); GET
  `src/app/api/coach/remote/[id]/tracker-hits/route.ts` → `src/components/sales-coach/TrackerHitChips.tsx` on the session page.

## Tests

`src/lib/coach/remote/__tests__/{state,stage,rubric,trackers,trackerScan}.test.ts`,
`src/app/api/coach/sales-session/[id]/stage/__tests__/route.test.ts`,
`src/app/api/coach/remote/trackers/__tests__/route.test.ts`; mocks added to scoreSession, upload-recording,
upload-recording/sign and generateSessionArtifacts tests.
