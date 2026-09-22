---
started_at: 2026-09-22T10:07:00+08:00
trigger: Project 4 is the last of the guide's five that is not built. Projects 1, 2, 3 and 5 are deployed; the Recordings tab is the remaining gap, and Pattern Interrupt's clips depend on it.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the last project, and the one that makes a score arguable

## Why this one matters more than its position suggests

Four projects are live. A manager can see a team average, a rep's sections, and a pattern that says
someone missed the neighbourhood notice in five of their last seven pitches.

None of that is currently **checkable**. Every number on every board traces back to an LLM's reading
of a recording, and until a manager can press play at 0:12 and hear the opener for themselves, the
whole system asks to be trusted. §3.3 is explicit that making the human a participant is what makes
an accurate-but-unwelcome finding survivable, and A11 is explicit that the system mirrors rather
than judges. A score with no audio behind it is a verdict.

This is also the project three other surfaces are waiting on: Pattern Interrupt's clips, the
Breakdown board's timestamps, and the rep's own Pitch detail play buttons all point here.

## The plan, quoted

Guide Step 4, seven items:

1. Recording list — newest first, date, time, length, outcome badge, Pitch Score, number of
   pattern moments. Label non-qualifying pitches "Not counted."
2. Player — audio with a waveform, play/pause, −10s / +10s, and speed (1x, 1.25x, 1.5x, 2x).
3. Timeline markers above the waveform from `pitch_elements` and `pitch_events`: missed elements
   and violations (red), Pattern Interrupt moments (brown), bonuses (green), manager comments
   (blue). Clicking a marker seeks to it.
4. Key moments list — the same markers with timestamp and points; click to seek.
5. Transcript at the playhead — the lines around the current time, flagged line highlighted.
6. Comment at timestamp — save to `recording_comments`; "Save and send to rep" notifies the rep
   and shows the comment in their Pitch detail.
7. "Adjust score" writes to `score_overrides` and recalculates. "Save as team example" needs the
   rep's permission before other reps can hear it.

## What already exists, checked rather than assumed

This is the fourth build in a row where the answer was "most of it is already there", so the search
came first this time:

- `pitch_scores.audio_url` and `.transcript` — the recording and its text. Present since 0252.
- `pitch_score_elements.timestamp_s` + `.evidence` — every graded element already carries where it
  happened and what the AI heard. That IS the marker set for missed elements.
- `pitch_score_events.timestamp_s` — same for bonuses and violations.
- `pitch_score_overrides` (0255) + `apply_pitch_score_override` (0256) — "Adjust score" is built.
  The guide calls the table `score_overrides`; the product named it `pitch_score_overrides`. Same
  thing, and this is the third time the guide's name for a table differs from the product's.
- `patterns` (0258) — Pattern Interrupt moments, for the brown markers.
- `manager_notifications` with `pitch_score_corrected` (0257) — the notify path for "send to rep".

**Missing: `recording_comments` only.** 0252 deferred exactly it, with `recording_comments,
score_overrides → Project 4`, and one of those two turned out to be already built.

## The part that is not a player

Rendering audio is a solved problem. Two things here are not.

**A marker is a claim with a timestamp, and the timestamps may be absent.** `timestamp_s` is
nullable, and the scorer has a `timestampsUnavailable` flag — a pitch scored from a transcript with
no timing has grades and no positions. A marker list that silently drops those moments tells a
manager the pitch had three flagged moments when it had eight. The count and the placeable subset
are different numbers and both belong on screen.

**"Save as team example" is a permission, not a toggle.** The guide says it *"needs the rep's
permission before other reps can hear it."* A10 says the user sees what the system sees about them;
this is stronger — it is other people hearing a recording of them. Built as a REQUEST that records
who asked and when, never as a manager-side switch, or the first time it is used it will be used
without asking.

## What could go wrong, before I look

1. **A fourth definition of a key moment.** The Breakdown board, Pitch detail and Pattern Interrupt
   all already render timestamped moments. If this build derives its own ordering or its own
   points-per-moment, four surfaces will disagree about the same pitch.
2. **Markers placed at `timestamp_s = 0`** when the value is null — every unplaced moment stacking
   at the start of the waveform, which looks like a catastrophic opening.
3. **The transcript is one text column.** "Lines around the playhead" needs speaker turns and
   times; a single string has neither, and splitting on newlines is a guess about a format nobody
   has specified.
4. **A comment sent to a rep with no way for them to see it.** Item 6 says it appears in their
   Pitch detail. Writing the row without wiring the read is the A31 seam again.
5. **Audio that is not there.** `audio_url` is nullable and the Recordings list shows pitches
   regardless. A dead play button is worse than a disabled one.
6. **Overriding a score from two places.** The dispute queue already adjusts scores. A second path
   that does not go through `apply_pitch_score_override` would bypass the append-only override log.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T10:08:00+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The search came before the design this time. Of the two tables 0252 deferred to this project, one was already built under a different name — which is the fourth instance today and the reason the 'what already exists' section is above the plan rather than below it." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T10:08:30+08:00",
    "why_it_governs": "Methodology in the tree, read at the moment of action.",
    "how_this_build_will_embody_it": "Step 4's seven items are quoted from the guide. The column names above were read from 0252 and 0255 rather than recalled." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "78-84", "read_at": "2026-09-22T10:09:00+08:00",
    "why_it_governs": "Holistic — trace the ripple.",
    "how_this_build_will_embody_it": "Three surfaces already render timestamped moments from these tables. Whatever this build derives has to be the same derivation, or a manager and a rep will count a pitch's flagged moments differently." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T10:09:30+08:00",
    "why_it_governs": "Four layers; layer 3 asks whether the feature leaves the user able to continue.",
    "how_this_build_will_embody_it": "A comment saved and not visible to the rep is layer-2 complete and layer-3 broken — the manager's next action is to expect a reply that cannot come." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T10:10:00+08:00",
    "why_it_governs": "THINK first about what could fail, then search.",
    "how_this_build_will_embody_it": "Six hypotheses before writing. The two that shape the build are nullable timestamps and the transcript having no line structure." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-334", "read_at": "2026-09-22T10:10:30+08:00",
    "why_it_governs": "Consume the verdict; never re-derive.",
    "how_this_build_will_embody_it": "Score adjustment goes through `apply_pitch_score_override`, which already exists and does no arithmetic of its own. A second write path would bypass the append-only log the dispute queue depends on." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T10:11:00+08:00",
    "why_it_governs": "Append-only; state derived by replaying.",
    "how_this_build_will_embody_it": "`recording_comments` is a log, not editable notes: a comment sent to a rep cannot be quietly rewritten afterwards, because the rep has already read it." },

  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-363", "read_at": "2026-09-22T10:11:30+08:00",
    "why_it_governs": "Guide, don't overtake; making the human a participant is what makes an accurate but unwelcome finding survivable.",
    "how_this_build_will_embody_it": "The clause this whole project serves. Until a manager can press play at the moment a score docked points, every board in the product asks to be trusted rather than checked." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T10:12:00+08:00",
    "why_it_governs": "The pre-action checklist.",
    "how_this_build_will_embody_it": "Item 5a in particular: a manager's workflow here is listen, then act — comment, adjust, or assign a drill. Each of those has to land somewhere the rep will see." },

  { "id": "A10", "source_file": "ThinkerThinker.md", "line_range": "260-274", "read_at": "2026-09-22T10:12:30+08:00",
    "why_it_governs": "The user sees what the system sees about them; no shadow read.",
    "how_this_build_will_embody_it": "Directly binding on item 7. 'Save as team example' means other reps hear a recording of this one, which is beyond a shadow read — it is a shadow broadcast. Built as a request with an actor and a timestamp, never a manager-side switch." },

  { "id": "A11", "source_file": "ThinkerThinker.md", "line_range": "275-292", "read_at": "2026-09-22T10:13:00+08:00",
    "why_it_governs": "The system mirrors; it does not judge. A verdict from an authority is wrong some fraction of the time.",
    "how_this_build_will_embody_it": "The audio IS the mirror. A marker says 'here is the moment the score moved' and the manager listens and decides; the alternative is a number nobody can check." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-479", "read_at": "2026-09-22T10:13:30+08:00",
    "why_it_governs": "Methodology in the tree, read in session, never cited from cached labels.",
    "how_this_build_will_embody_it": "Applied to the SCHEMA this time: every column named above was read out of its migration before being designed against, because the last four builds each found the product had something the guide named differently." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-593", "read_at": "2026-09-22T10:14:00+08:00",
    "why_it_governs": "Same name, different feature, across modules.",
    "how_this_build_will_embody_it": "`score_overrides` in the guide is `pitch_score_overrides` in the product — the third such rename today after `rep_activity`/`rep_kpi_daily` and `pitches`/`pitch_scores`. Checked before writing a migration for a table that exists." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-644", "read_at": "2026-09-22T10:14:30+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "A10 and A11 are cited above having been read today, not yesterday — the commit hook caught exactly this omission on the previous build." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T10:15:00+08:00",
    "why_it_governs": "A lesson in prose returns; gate the class, and keep the gate quiet.",
    "how_this_build_will_embody_it": "The nullable-timestamp hazard is gateable by construction rather than by care: if the marker type cannot hold a null position, an unplaced moment cannot be rendered at zero." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-819", "read_at": "2026-09-22T10:15:30+08:00",
    "why_it_governs": "Schema-complete is not built.",
    "how_this_build_will_embody_it": "Item 6 is the live risk: writing `recording_comments` without wiring the rep's Pitch detail to read them would be a feature that exists in the database and nowhere a rep can see." },

  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-196", "read_at": "2026-09-22T10:42:00+08:00",
    "why_it_governs": "A feature depending on config outside the repo is not operationally complete until that precondition is verified end-to-end OR documented as a blocking setup step; prefer failing LOUD over silently.",
    "how_this_build_will_embody_it": "The waveform depends on the production audio URL being CORS-readable by a browser, which cannot be verified from here. Read after writing closure.md, which cited the clause without having read it — the A22 failure, caught by the manifest gate. The clause's actual requirement is stronger than what I had written: it asks for a LOUD failure, and `peaks.ts` already gives one (a visible one-line reason on the strip, not a silent flat track), so the citation stands and is now earned." },

  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-22T10:43:00+08:00",
    "why_it_governs": "A migration is a replayable description of intended state, not a one-shot script. Every DROP needs IF EXISTS, every CREATE that references a name needs IF NOT EXISTS, and partial prior state must be tolerated.",
    "how_this_build_will_embody_it": "0259, 0260 and 0261 are written to A12's three-state checklist: 0260 uses `create table if not exists` plus `drop policy if exists` before each `create policy`, and 0261 drops the type CHECK before re-adding it exactly as 0257 did. Verified by running `npm run db:dry` AFTER `db:apply` — nothing pending, so the ledger and the schema agree. Read here because check.md cited A12 from a cached label, which is precisely the failure A22 describes." },

  { "id": "§3.2", "source_file": "CLAUDE.md", "line_range": "347-351", "read_at": "2026-09-22T10:55:00+08:00",
    "why_it_governs": "The Understanding Gate is structural: a problem may not reach a human until it links to enough supporting signals. The bottleneck is encoded, not left to discretion.",
    "how_this_build_will_embody_it": "Read because it appears in the staged diff. It bears on this build at one point: the pattern markers. A brown marker is only drawn for an item the rep has an OPEN pattern on, and `patterns` rows are opened by the 3-in-10 detector rather than by a single bad pitch — so the strip cannot tell a manager 'this is a pattern' off one miss. The encoded threshold is the detector's, consumed here as a verdict." },

  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-09-22T10:56:00+08:00",
    "why_it_governs": "No instant results; month 1 is a control with guidance off, and the system must refuse to behave identically for every customer on install.",
    "how_this_build_will_embody_it": "Read because it appears in the staged diff. This tab is deliberately OUTSIDE the control gate and that is the right call: it renders the rep's own recording, the scorer's own findings and the manager's own words. None of it is AI guidance, so suppressing it during month 1 would hide a rep's audio from them to protect a baseline that the audio is not part of." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "404-418", "read_at": "2026-09-22T10:57:00+08:00",
    "why_it_governs": "Knowledge is not intelligence; distrust the confident answer that arrived too quickly. The biggest risk is the builder under pressure.",
    "how_this_build_will_embody_it": "Read because it appears in the staged diff, and earned twice today. Once when a fluent `cat >` destroyed a route I had not opened — the confident fast action, exactly this clause. Once when a surviving mutant could have been dismissed as equivalent-by-assertion; it was proved inert and the code deleted instead of defended." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-22T10:16:00+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code on its own line — the mistake this session already made once and reported to the founder as a pass." }
]
```
