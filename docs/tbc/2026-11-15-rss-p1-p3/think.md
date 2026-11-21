---
started_at: 2026-11-14T23:10:00Z
trigger: Founder 2026-11-15, "continue building all buildable items" / "stop pausing" — RSS plan docs/rss, Phases 1 and 3 (what needs no open decision).
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - RSS Phases 1-3: remote capture, the remote session page, D6 caveat, keyword trackers

## The record

- coaching_sessions.context is ('in_person','video') (0070:36); 13 files hard-code it and 8 prompts describe
  every non-door call as "online video call". useLiveCoaching treats video's mic as rep-only.
- Outcome capture: the 2026-08-29 founder ruling (after-pitch page) keeps the outcome prompt SKIPPABLE, because a
  required field produces rushed taps (§3.5). The plan's F25.9 makes it required for phone/video. Conflict →
  founder decision; not built.
- finalize runs on Stop with keepalive so a closed tab keeps the transcript; outcomes are set later.
- rubric_config's flag is is_active (0252:72); the scaffold's 0274 index used `active`.
- generateSessionArtifacts is the shared post-transcript path (finalize, label-transcript, recovery, backfill).

## Built / not built

- Built: 0275 (phone + session_failures), sessionContext.ts, phone in UI and prompts, state.ts, failure writer
  wired to scoring and uploads, stage derivation + route + chips, D6 caveat, 0276 trackers + scan + routes +
  editor + hit chips, one scoring-floor constant.
- Phase 2 (founder picker 2026-11-15 "Store them, estimate old calls"): 0277 adds ended_at, carries it through
  the diarizer, upload, labelling, recovery and both transcript RPCs (0270 text verbatim + one column), and stores
  session_interaction_stats per transcript version; the session page gets the player, lanes with speaker
  isolation, the stat strip beside the rep's own 30-day average (never a benchmark), transcript search and
  tap-to-seek. Required outcome: founder kept it skippable (2026-11-15), so not built, by decision.
- Not built: completion notice (needs a notification type), the scorer
  reading per-channel rubrics and N/A per element (scoring-engine change; untestable here), Phase 2 (needs
  segment end times).

## Session-read manifest

```json
[
  {
    "id": "\u00a70",
    "source_file": "CLAUDE.md",
    "line_range": "10-12",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "Before adding 'phone', every place that branches on the session channel had to be found, as the plan's Phase 1 step 1 says.",
    "how_this_build_will_embody_it": "Swept: 13 files with a literal union and 8 prompts that called any non-door call a video call; all now read sessionContext.ts."
  },
  {
    "id": "\u00a70.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-22",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "The build plan and constitution must be read in session.",
    "how_this_build_will_embody_it": "docs/rss read; constitution printed at the recorded time."
  },
  {
    "id": "\u00a71.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-78",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "Layer 3: a phone call must flow from start to review the way video does.",
    "how_this_build_will_embody_it": "Phone option on both start surfaces, labels on list/session/review, stage chips on the session page, tracker editor in Settings and hit chips on the session."
  },
  {
    "id": "\u00a71.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-139",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "Audit what the plan could not see.",
    "how_this_build_will_embody_it": "Found the plan's 0274 index on a non-existent column (active vs is_active), the editable-tracker hole, and the required-outcome conflict with a recorded founder ruling."
  },
  {
    "id": "\u00a71.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-174",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "Phone sessions and trackers depend on unapplied migrations.",
    "how_this_build_will_embody_it": "Starting a phone session before 0275 says the update may be missing; trackers and failures say they wait on 0276/0275."
  },
  {
    "id": "\u00a72.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-307",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "One list per concept: channels, outcomes, upload limit, scoring floor.",
    "how_this_build_will_embody_it": "sessionContext.ts, outcomeLabels.ts reused by state.ts, AGENT_MAX_BYTES not copied into decisions.ts, MIN_AGENT_SEGMENTS reads SCORING_FLOOR."
  },
  {
    "id": "\u00a73.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-340",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "Failures and tracker hits are history; tracker words must not change.",
    "how_this_build_will_embody_it": "Append-only rules on session_failures and tracker_hits; trigger lets a tracker only be switched off."
  },
  {
    "id": "\u00a76",
    "source_file": "CLAUDE.md",
    "line_range": "434-436",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "The required-outcome rule conflicts with a recorded founder ruling.",
    "how_this_build_will_embody_it": "Not built; put to the founder as a picker."
  },
  {
    "id": "A10",
    "source_file": "ThinkerThinker.md",
    "line_range": "260-260",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "Reps should see what their calls are listened for.",
    "how_this_build_will_embody_it": "Tracker list readable by everyone in the company; hits readable by the rep."
  },
  {
    "id": "A12",
    "source_file": "ThinkerThinker.md",
    "line_range": "293-293",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "0275/0276 must survive the re-apply pass.",
    "how_this_build_will_embody_it": "Context check dropped by definition and re-added; if-not-exists / or-replace throughout."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-455",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "The plan is methodology for this work.",
    "how_this_build_will_embody_it": "Read from docs/rss before each phase."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-594",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "Every citation needs an in-session read.",
    "how_this_build_will_embody_it": "Only these clauses are cited."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-770",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "Rules must be gates.",
    "how_this_build_will_embody_it": "Append-only DB rules, the tracker trigger, and route tests for manager-only writes and tree-filtered scans."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1001",
    "read_at": "2026-11-14T23:27:44Z",
    "why_it_governs": "npm run check cannot run here.",
    "how_this_build_will_embody_it": "check.md says nothing was executed."
  }
]
```
