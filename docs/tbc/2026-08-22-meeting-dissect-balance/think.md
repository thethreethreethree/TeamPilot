---
started_at: 2026-08-22T02:55:00+08:00
---

# THINK — Speaker balance in the Dissect (the plan's imbalance monitor, realized)

The plan's §3.1 "imbalance" monitor was the ONE the live coach couldn't ground — a single room mic gives no
reliable per-speaker split, so the live brain stays silent (A39: never guess who dominated). But the post-meeting
Dissect runs on a BATCH-diarized re-transcription with REAL speaker labels, so "did one voice dominate?" IS
answerable there. This realizes it: `computeSpeakerBalance` (pure) measures each speaker's WORD share (not turn
count — short interjections shouldn't read as domination), flags a dominant voice above a proposed threshold, and
returns null below 2 speaking participants (§3.4 — can't assess balance from one voice, so say nothing).

Integration: the balance is computed from the segments in `generateMeetingDissect` (not the LLM — it's arithmetic,
not judgment), added to the `MeetingDissect` + the stored payload, and rendered in `MeetingReview`. It does NOT
affect `hasSignal` (a purely-social meeting still stores nothing) — it's a supplementary consequence on a dissect
that already has signal. A PROPOSED field like the rest of the measurement (founder can drop it or tune the
threshold).

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Understanding precedes solving — realized the monitor where it's actually groundable (batch diarization), not where it isn't (live).",
    "how_this_build_will_embody_it": "Balance is computed in the Dissect from diarized segments, not forced onto the live unlabeled stream." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Layer-2 — the balance is only real if it reaches the review surface.",
    "how_this_build_will_embody_it": "Computed in generate, stored in the payload, and rendered in MeetingReview." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Proactively complete the plan's monitor set where the data now supports it.",
    "how_this_build_will_embody_it": "Realized the deferred imbalance monitor post-hoc, rather than leaving it a forever-gap." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "The balance is stored as an append-only event field, not a mutable score.",
    "how_this_build_will_embody_it": "Added to the meeting.dissect_generated payload alongside the other consequences." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Honesty is the moat — never fabricate a balance verdict the data can't support.",
    "how_this_build_will_embody_it": "Returns null below 2 speaking participants; measures words actually spoken, no guesses." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood WHERE the monitor is groundable, traced ripple (type+generate+store+UI), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session (02:57) before this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Encode the lesson — the balance rules are pinned by tests.",
    "how_this_build_will_embody_it": "4 speakerBalance tests lock the null-below-2, word-not-turn, and dominance behavior." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3606 tests, exit 0), pasted in check.md." },
  { "id": "A39", "source_file": "ThinkerThinker.md", "line_range": "1026-1042", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Multi-party attribution must be carried at the source — never guessed; the live stream can't, the diarized transcript can.",
    "how_this_build_will_embody_it": "Balance is computed only from the BATCH-diarized transcript (real labels); the live coach still stays silent on imbalance." }
]
```
