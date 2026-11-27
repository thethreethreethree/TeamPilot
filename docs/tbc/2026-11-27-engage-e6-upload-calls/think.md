---
started_at: 2026-11-27T00:27:00Z
trigger: Engage plan E6 (docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN/docs/07-BUILD-ORDER.md), decisions E7 (amended) and E10, founder pickers 2026-11-27.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Engage E6: upload a call by API

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: 0387 (upload scope, call_needs_voice notice); transcribeUpload.ts (shared); POST /api/v1/calls; keys route and panel; PickYourVoice on the call page; bell; audit action; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: build E6 as planned, with E10 as decided.
- why-this-problem-exists: keys were read-only (E7); an upload needed a rep at the screen to pick a voice.
- record-consulted: the plan (00 E7/E10, 02 E6, 05 routes, 07 E6), upload-recording route, attribute-unlabelled (owner-only, scores via after()), transcriptVoices, consent route and RecordingConsent, createSession / setSessionStatus, notify.ts call_ready, 0378/0379.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one shared transcription, one upload handler, one card.
2. operational-effect: a dialer posts a recording → the call is on the rep's list, transcribed, waiting → the rep answers → scored.
3. synergetic-comp: the card also answers any remote call left with unknown voices (an app upload left unanswered, a recovery).
4. surface: the bell says what to do; the card asks consent first.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "No new outside setting; transcription uses the existing speech service.",
    "how_this_build_will_embody_it": "Its failure is reported in the reply (transcription_failed) and recorded as the call's closed reason."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Understand first: Engage plan E6 (07-BUILD-ORDER, founder picker 'Add an upload calls key scope') and E10 (founder picker 'Rep picks it in the app'). An app upload is scored only after the rep says which voice is theirs; an API upload has no rep present.",
    "how_this_build_will_embody_it": "The call is stored and transcribed as an app upload, then waits for its rep: consent + voice pick on the call page, which scores it."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Holistic: the upload's transcription is shared, not copied — moved from the upload route into transcribeUpload.ts, used by both.",
    "how_this_build_will_embody_it": "The route's 26 tests pass unchanged."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Layer 4: brand tones only (no red/green), each band with its label and share.",
    "how_this_build_will_embody_it": "BAND tones + text."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "One path for uploaded audio; one owner-only voice answer (attribute-unlabelled) that scores the call.",
    "how_this_build_will_embody_it": "No second transcription or scoring path."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Append-only: the voice answer writes a new transcript version (assign_session_voices); consent is an event.",
    "how_this_build_will_embody_it": "Existing routes."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "The rep, not the integrator, says which voice is theirs and that the customer knew it was recorded.",
    "how_this_build_will_embody_it": "Consent before the pick; owner-only."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Erasure: the call is an ordinary call (audio, transcript, events), so the existing erasure reaches all of it.",
    "how_this_build_will_embody_it": "No new store of customer words."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Nothing half-understood: sections must cover real, consecutive lines; the first bad one ends the read; under two is nothing.",
    "how_this_build_will_embody_it": "parseSections."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-27T01:07:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-404",
    "read_at": "2026-11-27T01:14:00Z",
    "why_it_governs": "Measurement rules: duration is a hard metric, so an uploaded call must carry its recording's real length, not the session's wall-clock.",
    "how_this_build_will_embody_it": "transcribeUploadedAudio stamps audio_duration_seconds from the transcription for app and API uploads alike (moved unchanged)."
  }
]
```
