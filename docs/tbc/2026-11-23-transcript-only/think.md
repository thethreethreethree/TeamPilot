---
started_at: 2026-11-23T08:12:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, transcript-only mode (gong.io capture M36 "getting a Zoom transcript without recording the meeting", graded PARTIAL: "Audio is removed after 90 days (D14) or by a manager; no 'never keep audio' setting").
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Keep transcripts only

## The record

- Retention is one pure decision (retention.ts: ruleFor, outsideRetention) read by the nightly purge cron and the
  settings route; settings are append-only rows (0284; 0308 made the count nullable for "back to the standard").
- The cron fails closed if settings can't be read, removes audio + chunks per session (removeRecordingAudio) and nulls
  the pointer; saved recordings are never candidates; it reports an honest `bounded` flag.
- Our transcripts come from the audio (ElevenLabs / live capture), so audio must exist at least until transcribed.

## Outside view

The failure to fear is irreversible: removing audio before its transcript exists loses the call. Others: a live call
losing its audio mid-recording; a long transcript misread as empty by a capped query; an admin turning it on without
knowing what stops working; a screen promising "never recorded".

## Design

1. 0314: transcript_only on company_recording_settings (no count with it).
2. ruleFor returns the transcript_only rule (graceHours 24); outsideRetention removes a call only when hasTranscript is
   true, the call is not live, and it is older than 24 hours.
3. Cron: for transcripts-only companies, per-call head count on coaching_transcript_segments_current; a failed check
   keeps the audio; counts reported.
4. Settings route PUT transcriptOnly (admins, audited); Protection screen option with a confirm that lists what is lost.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "Understand before building: how retention is decided (retention.ts ruleFor/outsideRetention), how the purge cron acts on it, how the setting is stored (0284, 0308) and shown were read first.",
    "how_this_build_will_embody_it": "The record section names each; the new mode is one more rule in the same single function."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "Layer 3: a transcript must exist before its audio goes, or the call is lost.",
    "how_this_build_will_embody_it": "The cron removes audio only when the current transcript is known to have lines, the call is finished and a day old; an unknown answer keeps the audio."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "Holistic: removing audio early takes away playback, pattern clips and re-transcription for those calls.",
    "how_this_build_will_embody_it": "The confirm step names each loss before an admin turns it on; saved recordings stay exempt as for every rule."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "Look past the task: the Protection screen hid a failed retention read behind 'Loading…'.",
    "how_this_build_will_embody_it": "It now says 'Couldn't load' with Try again (F1)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "A feature is not done while its migration waits outside the repo, and this cron reads the new column.",
    "how_this_build_will_embody_it": "0314 applied before any deploy; without it loadRetention fails closed and the cron purges nothing."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "One rule decides what audio is deleted.",
    "how_this_build_will_embody_it": "ruleFor/outsideRetention in retention.ts is the only decision; the cron and the settings route both import it and TRANSCRIPT_ONLY_GRACE_HOURS."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "A retention change is a fact with history.",
    "how_this_build_will_embody_it": "A new settings row (transcript_only), never an update; a later row ends it."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "Legal erasure is the one deletion exception for personal data.",
    "how_this_build_will_embody_it": "Unchanged; this mode removes only audio bytes, like the existing retention purge, and keeps the call record."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "Guide, don't overtake: deleting audio sooner is the company's choice.",
    "how_this_build_will_embody_it": "Off unless a company admin turns it on, after a confirmation that lists what is lost."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "Honesty: 'transcript only' cannot mean 'never recorded'.",
    "how_this_build_will_embody_it": "The screen says every call is still recorded to be transcribed and its audio removed after; the cron reports checks and check errors."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No founder decision was taken: the mode is off by default and each company chooses."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Two mutation checks show the tests fail if the transcript or live-call condition is dropped."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T08:18:36Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
