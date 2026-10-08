# BUILD - keep voices apart

### Each line keeps its voice

- **write-path:** `supabase/migrations/0270_transcript_speaker_cluster.sql`; `salesCoach.ts` (replace payload
  `speakerId`, append `speakerCluster`, mapSegment); `transcriptRecovery.ts` labeled `speakerId`;
  `upload-recording/route.ts` unattributed save.
- **read-path:** `scripts/sql/probes/0270-transcript-voices.sql`; `transcriptRecovery.voices.test.ts`.

### One verdict for the per-voice question

- **write-path:** `src/lib/coach/v5/transcriptVoices.ts`.
- **read-path:** `src/lib/coach/v5/__tests__/transcriptVoices.test.ts`.

### The answer names the rep's voice

- **write-path:** `attribute-unlabelled/route.ts` (`agentCluster` -> assign_session_voices; `mine: true` -> 409 with
  voices); `segments/route.ts` returns source and speaker_cluster; after-pitch card asks per voice.
- **read-path:** attribute-unlabelled `__tests__/route.test.ts` "a call with two voices".

### The app asks per voice

- **write-path:** app `src/lib/audio/relabel-unknown.ts` (voicesFromTranscript, attributionBody), `[id].tsx`,
  `types/backend.ts`.
- **read-path:** app `tests/relabel-unknown.test.ts`.

### The card can be render-tested (appended 2026-10-08T14:05Z)

- **write-path:** `src/components/sales-coach/BlankReadRecovery.tsx` (moved out of the After-Pitch page unchanged;
  a Next page file may export only its page).
- **read-path:** `src/components/sales-coach/__tests__/BlankReadRecovery.render.test.tsx`.
