---
started_at: 2026-08-22T13:11:00+08:00
---

# THINK — Prep-up Phase 5: wire-in (Team-Sync)

Connect the shipped Prep-up pieces (Ph1 data/routes, Ph2 UI, Ph3 agenda brain) into a working end-to-end loop:
Prep-up → "Start Meeting" → a session BOUND to that prep → the live coach loads the agenda (Ph3 already reads
the prep by session_id). Founder chose this as the next step.

## What Phase 5 does
- The meeting-session create route accepts an optional `prepId`; after creating the session it links the prep
  (`markMeetingPrepStarted({ prepId, sessionId })`) so the Ph3 cue route finds the agenda by `session_id`.
  Best-effort (a failed link degrades to a prep-less meeting; never blocks the meeting).
- `MeetingCoachingPanel` takes `initialPrepId` (read SERVER-SIDE from the `?prepId` query in the page → no
  useSearchParams/Suspense fragility) and sends it on create; a "your prep is loaded" indicator shows in setup.
- Prep-up ↔ live coach are connected in-page: the setup screen offers "Prep this meeting first →" (→ /prep), and
  Prep-up's "Start Meeting" navigates to the coach with `?prepId` (Ph2).

## Scope boundary (honest)
The GLOBAL sidebar nav entry + module-access gating are DEFERRED to go-live (§1.5.3) — adding a global nav entry
now would advertise a feature that can't persist until migrations 0237 + 0238 are applied (founder db:apply).
The loop is reachable/usable by URL (as the Meeting Coach MVP already is); the global nav + gating land with the
migration apply + device test at go-live.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "Understanding precedes solving — the link uses the Ph3 session_id lookup already built.",
    "how_this_build_will_embody_it": "prepId → session link → the cue route finds the agenda; no new lookup invented." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A19/A22/A38 via Read this turn (13:12)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "Layer-3 workflow continuity — Prep-up must flow into the live meeting, not dead-end.",
    "how_this_build_will_embody_it": "Start Meeting carries the prep; setup offers Prep-first; the coach shows it's loaded." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "Proactive audit — a failed prep-link must not block the meeting; prep-less still works.",
    "how_this_build_will_embody_it": "markMeetingPrepStarted is best-effort; no prepId → prep-less meeting (tested)." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "171-190", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "External-config completeness — global nav shouldn't advertise a pre-migration feature.",
    "how_this_build_will_embody_it": "Global nav + module-gating deferred to go-live (0237+0238 apply); loop usable by URL now." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: reused the Ph3 lookup, traced ripple (prep-less unchanged), stated the nav deferral." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this turn." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Route tests lock: prepId → markMeetingPrepStarted(sessionId); no prepId → not linked." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T13:12:46+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check; exit-0 output in check.md." }
]
```
