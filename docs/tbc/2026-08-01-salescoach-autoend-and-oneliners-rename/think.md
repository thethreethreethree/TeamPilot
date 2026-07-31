---
tbc_version: 1
trigger: feature
started_at: 2026-08-01T06:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 2
---

# THINK — Sales Coach revisions: auto-end on recording (B) + rename Strategy→One Liners (C)

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json (verified by
`sha256sum` — see build.md for the command + output).

## 2. Why (founder directive, decisions gathered before building — guide-don't-overtake: surface decisions first)

The founder prioritised "all Sales Coach build and Edit revision". Three items were open (the memory's "3
nav calls"). I surfaced the genuine product-design decisions rather than guessing, and the founder chose:

- **A — manager gating:** keep Analytics/Session rep-visible. → NO code change (current behaviour is already
  correct). Recorded so a future reader knows it was a deliberate confirmation, not an oversight.
- **B — auto-end on recording complete:** finishing a recording (upload `onLabeled` OR live
  `onRecordingSaved`) now auto-ends the session, then lands on After-Pitch. WHY it matters: without an end,
  the session stays `active`, so `ended_at` is never stamped and the duration + the avgSessionDuration KPI
  never populate (a §3.5 measurement gap — the metric silently reads nothing for that session). Ending also
  unlocks the post-call flow in one step instead of forcing a separate "End session" tap (§1.5.1 layer-3
  workflow continuity).
- **C — rename Strategy → One Liners:** the nav item + the page title. It was already a Standard-only
  relabel (2026-07-28); the full rename makes the nav label and the page heading agree in both modes (§1.5.1
  layer-4 — a nav label and page title that disagree is a surface mismatch).

## 3. Design + interconnection trace (holistic — trace ripple before acting)

- **B is safe to fire even on an already-ended session.** Traced the write path: the PATCH sets
  `status:"ended"`; migration 0070's trigger `stamp_coaching_session_ended_at` stamps `ended_at := now()`
  ONLY on the `old.status='active' → new.status in ('ended','reviewed')` transition AND only when
  `new.ended_at is null`. So a re-end (rep already ended manually) is a no-op — the real end time is never
  overwritten. The end PATCH is non-blocking: on failure we still navigate (After-Pitch generates from the
  labeled transcript regardless), so a transient PATCH error never traps the rep.
- **C keeps the route path `/strategy`** so existing links/bookmarks don't break — only the visible label
  changes (nav, page title, and the two LearningHint category labels, which feed `askJeff` as context, not a
  seen-state key, so relabelling them re-shows nothing).

## 4. Hypotheses

- **H1 (B):** wiring both recording-complete callbacks to `endThenAfterPitch` marks the session ended (so
  duration/KPI populate) and still lands on After-Pitch, with no double-stamp of `ended_at` on re-end.
- **H2 (C):** renaming the nav label + page title to "One Liners" (route unchanged) leaves the page
  functional, typechecks (the now-unused `useExperienceMode` import removed), and no test asserted the old
  label/title.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-08-01T06:00:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding earned — I traced the 0070 end-trigger + the recording callbacks + the nav/title before changing behaviour, and gathered the founder's decisions before building.", "how_this_build_will_embody_it": "Section 2 states each why; section 3 traces the trigger idempotency." },
  { "id": "§0.1",   "read_at": "2026-08-01T06:00:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH via sha256sum." },
  { "id": "§1.5.1", "read_at": "2026-08-01T06:00:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Four layers — B is layer-3 (workflow continuity: one clean post-call step); C is layer-4 (nav label ↔ page title consistency).", "how_this_build_will_embody_it": "B removes the separate End-session tap; C makes label + title agree." },
  { "id": "§1.5.2", "read_at": "2026-08-01T06:00:00Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search — I searched for stale 'Strategy' references + tests before renaming, and traced the end trigger before auto-ending.", "how_this_build_will_embody_it": "check.md records the grep for stale label refs (none) + the trigger trace." },
  { "id": "§3.5",   "read_at": "2026-08-01T06:00:00Z", "source_file": "CLAUDE.md", "line_range": "300-315", "why_it_governs": "Measurement — B exists BECAUSE a never-ended session leaves ended_at null, so meeting/session duration (a hard metric) never records. Auto-end restores the measurement.", "how_this_build_will_embody_it": "B stamps ended_at via the transition, populating the duration KPI." },
  { "id": "§6",     "read_at": "2026-08-01T06:00:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced what B affects (the ended_at trigger, the KPI) and what C affects (label surfaces + the unused import).", "how_this_build_will_embody_it": "closure notes the bounded blast radius." },
  { "id": "A19",    "read_at": "2026-08-01T06:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across all entries." },
  { "id": "A22",    "read_at": "2026-08-01T06:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "This manifest + the commit's Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-08-01T06:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "128-132", "why_it_governs": "Don't cry wolf / don't ship a half-thing — B is non-blocking on PATCH failure so it never traps the rep, and idempotent so it can't corrupt end times.", "how_this_build_will_embody_it": "The end PATCH swallows errors and still navigates; re-end is a trigger no-op." },
  { "id": "A38",    "read_at": "2026-08-01T06:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run.", "how_this_build_will_embody_it": "check.md pastes the typecheck + test results with exit codes." }
]
```
