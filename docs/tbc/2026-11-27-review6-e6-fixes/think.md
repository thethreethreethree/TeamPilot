---
started_at: 2026-11-27T01:28:00Z
trigger: Independent review of 2810b5bf (E6) and 8fe70887 (team targets): 1 high, 3 medium, 6 low.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Review 6: API call upload and team targets

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: publicApiUpload.ts (signed upload, finalize, cap); /api/v1/calls/:id/finalize; attribute-unlabelled consent check; PickYourVoice; ForecastBoard + RemotePipeline teamView; forecast route; tests. Plan updated first (3291349a).
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: fix what the review confirmed, on the plan.
- why-this-problem-exists: the first E6 build sent the file through the function, which Vercel caps; cost and consent leaned on the screen.
- record-consulted: the review, upload-recording sign route and JSON branch (company-prefix path check, getAssetObjectInfo), createSignedUploadTarget, buildStoragePath, 0241 (bucket 250 MB), the consent route, attribute-unlabelled, ForecastBoard/RemotePipeline.
- conflicts-with-framework: NONE.
- ambiguities: NONE. Left (recorded): a call made by JSON and never finalized stays an empty call until auto-close; a retried request makes a second call; the bell shows call_needs_voice and later call_ready.

## FOUR-LAYER
1. build-structure: one handler module, two routes.
2. operational-effect: any call up to the channel's 100 MB uploads.
3. synergetic-comp: the stored file is checked exactly as the app's.
4. surface: the reply says what to do next (PUT, then finalize).

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "External: Vercel's request-body limit is an outside constraint the first build ignored.",
    "how_this_build_will_embody_it": "Signed direct upload, as the app does."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Understand first: the review of 2810b5bf found the one-request upload dead for any call past ~5 minutes (Vercel's ~4.5 MB body limit — the app's own upload signs a direct upload for this reason), no spend bound on transcription, consent unenforced on the server, the one-voice card without its sample, and the team row wrong with one rep picked.",
    "how_this_build_will_embody_it": "Signed upload + finalize (file named after the call), multipart only for small files; 200 uploads/day/key counted before transcription; consent required by attribute-unlabelled for API calls; first-line sample; team target on the whole-team view only, own team only, no % on 0."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Holistic: finalize reuses the app upload's stored-file checks (size, type) and the shared transcription; the answer route's new check touches only calls made by API.",
    "how_this_build_will_embody_it": "Other calls' answers unchanged (28 route tests)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Layer 4: brand tones only (no red/green), each band with its label and share.",
    "how_this_build_will_embody_it": "BAND tones + text."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "One path for uploaded audio; one owner-only voice answer (attribute-unlabelled) that scores the call.",
    "how_this_build_will_embody_it": "No second transcription or scoring path."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Append-only: the voice answer writes a new transcript version (assign_session_voices); consent is an event.",
    "how_this_build_will_embody_it": "Existing routes."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "The rep confirms consent before an API call is answered — now on the server too.",
    "how_this_build_will_embody_it": "409 consent-needed."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Erasure: the call is an ordinary call (audio, transcript, events), so the existing erasure reaches all of it.",
    "how_this_build_will_embody_it": "No new store of customer words."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Nothing half-understood: sections must cover real, consecutive lines; the first bad one ends the read; under two is nothing.",
    "how_this_build_will_embody_it": "parseSections."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-404",
    "read_at": "2026-11-27T02:04:00Z",
    "why_it_governs": "Measurement rules: duration is a hard metric, so an uploaded call must carry its recording's real length, not the session's wall-clock.",
    "how_this_build_will_embody_it": "transcribeUploadedAudio stamps audio_duration_seconds from the transcription for app and API uploads alike (moved unchanged)."
  }
]
```
