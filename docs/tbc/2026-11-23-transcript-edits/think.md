---
started_at: 2026-11-23T06:20:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, editable transcripts (gong.io capture M36 "Users can edit any line of a transcript", graded LACK); founder picker the same day "Rep + their managers".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Editable transcripts

## The record

- Transcripts are append-only and versioned (0269: version column, unique (session, version, seq)); every reader reads
  coaching_transcript_segments_current (latest version, minus trimmed lines; an invariant-audit rule).
- A trim (0284) already makes a new version with copy_transcript_version and re-runs generateSessionArtifacts — which
  is five paid AI engines plus trackers and stats.
- 0295: the base table's RLS also hides trimmed lines, in every version.
- Erasure (0285) deletes a session's transcript lines in every version and keeps the session row.
- The transcript view (SessionTranscript) is shared by Sales Coach and Remote Sales call pages.

## Outside view

An edit feature can quietly break the method: an overwrite destroys what was really heard; a rep rewriting their own
pitch changes what the AI reads with no trace; an edit log that stores the old words becomes a copy erasure doesn't
know about; re-running five paid engines per typo multiplies cost; editing during a live call races the live feed.

## Design

1. 0311: edit_transcript_line (service role only) copies the current version with one line replaced, under the same
   advisory lock as trims, and appends a transcript_line_edits row (no text). Same words → no new version.
2. Route GET/POST /api/coach/sales-session/[id]/transcript-edit: access = the call's rep, or a manager whose tree
   includes the rep; not while the call is live; the line must be in the current (untrimmed) transcript. Audit
   transcript.edit. Afterwards trackers and talk stats are redone (free); the AI summary and review are not.
3. Screen: pencil on each line for editors; "edited" mark reveals the original, the editor and the date.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Understand before building: how transcripts are versioned (0269), how a trim makes a new version (0284), how trims hide lines from the base table (0295) and how erasure deletes lines (0285) were read first.",
    "how_this_build_will_embody_it": "The record section names each; the design reuses the version mechanism instead of inventing an edit-in-place."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Layer 3: correcting a word must not strand the reader with stale AI notes they don't know about.",
    "how_this_build_will_embody_it": "After saving, the page says which reads now use the corrected words and that the summary and review can be regenerated."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Holistic: transcripts feed trackers, talk stats, AI summaries, search, erasure and trims.",
    "how_this_build_will_embody_it": "A correction is a new version read through _current like every other; trackers and stats are redone; erasure is unchanged because the edit log holds no words."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Look past the task: an edit is a write path for words that legal erasure must be able to remove.",
    "how_this_build_will_embody_it": "The edit log stores no text; the replay shows the session cascade removes edit rows too."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "A feature is not done while it waits on config outside the repo; 0311 must be live.",
    "how_this_build_will_embody_it": "0311 applied with db:apply; verify:live 32/32 (check.md)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Who may edit is decided once, in the route's access(); the screen consumes canEdit.",
    "how_this_build_will_embody_it": "SessionTranscript shows the pencil only when GET returns canEdit; POST re-checks the same access()."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "A correction must never overwrite what was heard.",
    "how_this_build_will_embody_it": "edit_transcript_line copies the version with one line replaced; the original stays in the earlier version (replay); edit rows cannot be updated."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Legal erasure deletes a customer's words in every version and must not miss a copy.",
    "how_this_build_will_embody_it": "transcript_line_edits holds seq, versions, editor and time only — no text — so erasure has nothing new to find."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Guide, don't overtake: who may correct a call was the founder's decision.",
    "how_this_build_will_embody_it": "Founder picker 'Rep + their managers'; nothing is corrected automatically."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Honesty: a corrected transcript must show that it was corrected.",
    "how_this_build_will_embody_it": "Every corrected line carries an 'edited' mark that shows the original words, who corrected it and when."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Who may edit went to the founder as a picker."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Permission, live-call refusal and fail-loud are tests; the tree rule was mutation-checked; the mfa invariant covers the new table."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T06:50:51Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
