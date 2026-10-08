---
started_at: 2026-10-03T13:38:00Z
trigger: Founder picker, "Keep voices apart", after the transcript-versions rollout found recovery saves an undecided two-voice call as all 'unknown' with no record of which voice said each line.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - keep voices apart

## The record

- transcriptRecovery: `labelFor(seg.speakerId, null)` is 'unknown' for every line when autoAssignAgentCluster does
  not decide; `labeled` carried speaker, text, seq, spokenAt and dropped speakerId.
- upload-recording `saveUnattributedTranscript` dropped speakerId the same way.
- /attribute-unlabelled: "A transcript saved as `unknown` is by construction ... exactly one voice"; `mine: true`
  relabelled every line 'agent'. The app's relabel-unknown.ts rested on the same sentence.
- Production, read-only, 2026-10-08: the 7 recovered sales calls are at version 2; 5 have one line, cef6995b 26
  lines and 8bde1ce2 44, all 'unknown', none with a voice id.
- The build was written 2026-10-03 13:38-14:00Z; resumed 2026-10-08 13:13Z after a pause.

## Design

0270: `speaker_cluster`; the view recreated to carry it; replace stores `speakerId`; relabel copies it;
`assign_session_voices(session, agent_cluster)` writes a new version (that voice agent, others customer, manual).
`transcriptVoices` is the one verdict for the per-voice question. Route takes `{ agentCluster }`, refuses `mine: true`
with the voices (409 needs-voice). Web card and app picker show one sample per voice.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "Understanding precedes solving: why would 'That's me' mislabel a call?",
    "how_this_build_will_embody_it": "Traced before building: recovery's labelFor gives every line 'unknown' when undecided and drops seg.speakerId at the save; the route's header assumed 'unknown' means one voice. Printed in full and read."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter; printed in full and read."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "Layer 3: what the rep does next after the question is answered.",
    "how_this_build_will_embody_it": "After answering, the call has agent lines from the rep's voice only and the coaching regenerates; a one-voice call keeps its old question. Printed in full and read."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "Audit as you work; the neighbour of the fix.",
    "how_this_build_will_embody_it": "The upload flow's unattributed save had the same drop (upload-recording saveUnattributedTranscript) and is fixed in the same build. Printed in full and read."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "One verdict, consumed by every reader.",
    "how_this_build_will_embody_it": "transcriptVoices decides 'per-voice question' for the route and the web card; assign_session_voices re-checks the same terms under a lock; the app mirrors it with tests naming the source. Printed in full and read."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "Append-only; history intact.",
    "how_this_build_will_embody_it": "The answer is a new version (assign_session_voices); nothing is updated or deleted. Printed in full and read."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-446",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "Item 0: the founder's pick; item 4: is the constraint real?",
    "how_this_build_will_embody_it": "Keep voices apart was the founder's pick; applying 0270 and re-reading calls go back to the founder. Items 0-5d printed and read."
  },
  {
    "id": "A12",
    "source_file": "ThinkerThinker.md",
    "line_range": "293-310",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "A migration must replay against a partial state.",
    "how_this_build_will_embody_it": "0270 is add-column-if-not-exists and create-or-replace throughout; the migration audit's re-run pass is clean. Printed in full and read."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Printed in full and read."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-615",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "A citation needs an in-session read.",
    "how_this_build_will_embody_it": "Printed and read; each entry names its time."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "Probe 0270 in the migration audit; route, recovery and app tests each fail on their mutation. Printed in full and read."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check and the app gate with exit codes in check.md. Printed in full and read."
  },
  {
    "id": "A39",
    "source_file": "ThinkerThinker.md",
    "line_range": "1026-1038",
    "read_at": "2026-10-03T13:38:55Z",
    "why_it_governs": "Per-party attribution must travel with multi-party text from the source; it dies at boundaries.",
    "how_this_build_will_embody_it": "The boundary here is recovery's save, where the diarizer's speaker id was dropped; it now travels to the row (speaker_cluster) and to the question. Printed and read."
  }
]
```
