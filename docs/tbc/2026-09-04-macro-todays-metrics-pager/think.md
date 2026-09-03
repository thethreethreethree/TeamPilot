---
started_at: 2026-09-04T02:20:00+08:00
---

# THINK — Macro "Today's Metrics" two-page pager (Gamified ⇄ Metrics)

## Why (founder-SPECIFIED experience — layer-2, not polish)
The founder gave an explicit UX: the Macro Mode mobile middle tab "Today's Metrics" (`/dashboard/sales-coach/doors/
todays-metrics`) becomes ONE module with TWO swipeable pages — the NEW gamified dashboard (default on tap) and the
ORIGINAL Today's Metrics screen — switched by a top segmented toggle AND a swipe (both, founder-chosen). Because the
founder *specified* the experience (the combination, the swipe, the toggle, the default landing), this design IS the
intended result (§1.5.4 / AMD-012): it must be built AND visually verified, not filed as deferrable polish.

## Understanding (from the code, §0)
- The middle tab is `MACRO_MOBILE_TABS` → `/doors/todays-metrics`, which today mounts `<TodaysMetrics/>`
  (`doorlog/TodaysMetrics.tsx`) — the door KPI field read (Doors/Conversations/Sales + Score Chart + Next-Door focus,
  Day/Week/Month/All-time). Root is `flex-1 min-h-0 overflow-y-auto` — it scrolls itself, needs a flex-col parent.
- The "gamified dashboard" is the rep Arena (`RepArena.tsx`, `/my-progress`): gauge/odometer/stats/records/milestones/
  bars, reading the caller's own `/my-points` + `/leaderboard`. Root `ra-wrap` does NOT scroll itself — it needs a
  scroll parent. (A Macro rep records pitches that get scored, so their session-gamification data applies here.)
- Two SEPARATE data systems coexist by design (door-Macro doorlog vs session gamification) — this pager places them
  side by side, it does NOT conflate them (memory: two separate KPI systems, don't conflate).

## The build
- New `TodaysMetricsPager.tsx` (client): a `flex-1 min-h-0 flex flex-col` module = a top segmented toggle
  (role=tablist: "Progress" | "Metrics") + a horizontal pager viewport. Track is `width:200%` with two 50% panes,
  `translateX(-page*50%)`, `transition-transform` (motion-reduce:none). Pane 1 = `overflow-y-auto` wrapping RepArena
  (gives it scroll); pane 2 = `flex flex-col` holding TodaysMetrics (which brings its own scroll). Default page 0 =
  Progress (Gamified), per "tap the tab → the gamified screen".
- Swipe: start/end-delta on the viewport (mirrors CareRadialHome's idiom) — NO preventDefault, so native vertical
  scroll inside each pane is untouched; a horizontal-dominant fling (|dx|>50 and |dx|>1.5·|dy|) switches page. The
  toggle is the primary, accessible control (tappable, keyboard); swipe is the enhancement (AMD-006 layer-4:
  discoverable + accessible, not swipe-only).
- Wire `/doors/todays-metrics/page.tsx` to mount the pager instead of the bare TodaysMetrics.

## Workflow continuity (AMD-006 / §1.5.1 layer-3)
A Macro rep taps the middle tab → lands on their gamified progress (motivating), sees the toggle, and swipes/taps to
the field metrics (actionable) — both under one tab, no navigation away. Right-before: door knocking. Right-after:
record a call (the CTA lives on the Metrics page). The pager leaves them in a flowing state on either page.

## Out of scope (surface, don't overtake)
The Scoreboard's MyProgress strip and the `/my-progress` desktop route are NOT touched — the founder's direction is
specifically the Macro Today's Metrics tab. Those remain as follow-ups if the founder wants them unified too.

## Session-read manifest (A22 — read_at ≥ started_at 02:20 2026-09-04)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-04T02:30:00+08:00",
    "why_it_governs": "Understanding precedes solving — I traced both components' roots + the mobile nav from the code before designing the pager, rather than assuming their shape.",
    "how_this_build_will_embody_it": "The pane wrappers are chosen from each component's actual scroll model (RepArena needs a scroll parent; TodaysMetrics brings its own)." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-04T02:30:10+08:00",
    "why_it_governs": "The methodology doc for the domain must be in the tree + read this session.",
    "how_this_build_will_embody_it": "docs/THINK-BUILD-CHECK-PROMPTS.md confirmed present; CLAUDE.md sections re-consulted this build." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-04T02:30:20+08:00",
    "why_it_governs": "Four-layer gate — esp. layer-3 workflow continuity (does the tab leave the rep flowing?) and layer-2 effectivity (does the swipe+toggle actually work end-to-end).",
    "how_this_build_will_embody_it": "Traced the rep's before/after workflow; both panes render working content; the pager is verified by rendering, not asserted." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-04T02:30:30+08:00",
    "why_it_governs": "Reuse the repo's patterns (touch idiom, theme tokens, the existing components) rather than templating new ones.",
    "how_this_build_will_embody_it": "Swipe mirrors CareRadialHome's start/end-delta; reuses RepArena + TodaysMetrics unchanged; app theme tokens + the shell's flex-1 min-h-0 slot." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-235", "read_at": "2026-09-04T02:30:40+08:00",
    "why_it_governs": "A user-SPECIFIED experience is layer-2, not waivable polish — the founder named the combination, the swipe, the toggle, the default page.",
    "how_this_build_will_embody_it": "The specified experience is built in full AND visually verified (mobile render) before it's called done." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-04T02:30:50+08:00",
    "why_it_governs": "Quick-decision checklist (reuse, workflow continuity, verify visually, don't overtake scope).",
    "how_this_build_will_embody_it": "Reused components + idiom, traced workflow, rendered to verify, kept scope to the Macro tab the founder pointed at." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-04T02:35:20+08:00",
    "why_it_governs": "The methodology must live in the working tree and be read this session, not cited from cached labels.",
    "how_this_build_will_embody_it": "THINK-BUILD-CHECK-PROMPTS.md + CLAUDE.md are in the tree; the cited axioms were re-opened this build before citing them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T02:35:30+08:00",
    "why_it_governs": "A lesson in prose returns; a fix isn't done until a GATE encodes it — for a UI unit, the behavior must be test-pinned.",
    "how_this_build_will_embody_it": "The pager's default page, toggle, swipe direction, vertical-drag-ignore, and end-clamp are all pinned by 6 render tests, not left to prose." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-640", "read_at": "2026-09-04T02:29:00+08:00",
    "why_it_governs": "Cite only assets re-read this session; the manifest is the artifact that proves it.",
    "how_this_build_will_embody_it": "Re-read the cited axioms this build; each § entry carries an in-session read_at; the commit carries the Session-Reads trailer." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-04T02:29:10+08:00",
    "why_it_governs": "'Verified' names the command + evidence, not a self-invented subset.",
    "how_this_build_will_embody_it": "check.md will name typecheck + the full gate + the mobile render, and mark anything not run." }
]
```
