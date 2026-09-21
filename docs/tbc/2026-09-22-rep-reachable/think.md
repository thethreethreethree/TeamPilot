---
started_at: 2026-09-22T08:30:00+08:00
trigger: R1 of the sweep's closure — I had built the sheet's three-tab sub-nav on /my-progress, whose nav entry is managerOnly, so the rep it was for could not open it.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — built, tested, and unreachable by the person it was for

## Why (the record)

From the closure written an hour earlier, rated the lowest-confidence residual in the file:

> *"I spent a build implementing the sheet's rep sub-nav on a page reps cannot reach from the nav —
> built, tested, eleven mutations, every check clean, and unreachable by the person it is for. That
> is A31's exact failure, and I have cited A31 in six consecutive builds while committing it."*

## What I actually got wrong, which is not "I picked the wrong file"

I read the sheet, found a three-tab sub-nav, looked for a page with two of those boards on it, and
found `/my-progress`. Every step was reasonable and I never asked the question that mattered:
**who can open this route?**

The answer was one line away — `{ label: "My Progress", href: "…", icon: Gauge, managerOnly: true }`
— in a file I opened during that build to check something else.

A31 says schema-complete is not built and names the seam between the database and the surface. This
is the same seam one step further out: **surface-complete is not reachable.** The component rendered,
the tests passed, the audits were clean, and the nav never showed it to a rep. No gate in this repo
asks whether a route's audience matches its contents, because `managerOnly` is a nav flag and not a
gate — `/my-progress` has no server check at all.

## The fix, and the thing it immediately broke

The pager at `/doors/todays-metrics` is the rep's real dashboard and already carried Progress and
Metrics under the sheet's own labels. It needed Breakdown in the middle.

Its geometry was hard-coded for two panes — `200%`, `50%`, `page * 50`. Adding a third against
those literals slides the track to the wrong offset and clips the last pane, **silently**, because
everything else still behaves: the page index is right, the tabs are right, the transform is a
transform. jsdom has no layout, so nothing would have failed.

Then deleting the duplicate sub-nav orphaned `PitchMilestones`, and `reachability:audit` failed the
build by name. That gate was built this session because three modules in one feature had no caller
in one day; it has now caught a fourth, created by a refactor, within hours of the class being
re-committed.

## What could go wrong, before I look

1. **Hard-coded halves** with three panes — invisible in jsdom.
2. **`pageOf` testing for `-50%`** — would report page 0 for every page of a three-pane track, and
   silently pass every navigation assertion in the file.
3. **Breakdown in the wrong slot** — the sheet's order is an argument, not a layout.
4. **An orphan left by the deletion.**

All four happened. Three became mutations; the fourth was caught by the gate.

## Session-read manifest

```json
[
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-22T08:32:00Z",
    "why_it_governs": "Schema-complete is not built — the seam between the database and the surface is where a correct system silently becomes a nonexistent feature, and it must be gated rather than watched.",
    "how_this_build_will_embody_it": "The asset I have cited in six consecutive builds while committing the failure it names, one step further out: surface-complete is not REACHABLE. The component rendered, the tests passed, the audits were clean, and the nav never showed it to a rep." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-22T08:33:00Z",
    "why_it_governs": "An authority returns a verdict and consumers branch on it; duplicated conditions drift because both are correct on the day they are written.",
    "how_this_build_will_embody_it": "Why `RepDashboardTabs` was DELETED rather than left beside the pager. Two tab lists over the same three boards is that shape somewhere no type can see it — the first page added to one would silently not appear in the other." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T08:34:00Z",
    "why_it_governs": "Four layers, foundation up; layer 2 asks whether the feature delivers the intended result when invoked the way a real user would invoke it.",
    "how_this_build_will_embody_it": "The previous build passed every layer-1 check and failed layer 2 on the plainest possible reading: the user could not invoke it. 'Does it work' has a precondition, which is 'can they get to it'." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-22T08:35:00Z",
    "why_it_governs": "Ground-up auditing; a problem at layer N propagates to every layer above it, so flags at the bottom are leveraged more than flags at the top.",
    "how_this_build_will_embody_it": "The pager's track width is as low as this feature goes and it silently determines whether the top layer exists at all. A clipped third pane is a missing board, not a layout blemish." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T08:36:00Z",
    "why_it_governs": "A lesson recorded only in prose will return; a fix is complete when the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Demonstrated twice over. Deleting the duplicate orphaned PitchMilestones and `reachability:audit` failed the build BY NAME — a gate built this session catching a fourth instance within hours. And the reachability of a ROUTE has no such gate, which is exactly why R1 happened in prose-only territory." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T08:31:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The diagnosis is not 'wrong file'. Every step of choosing that file was reasonable; the question that was never asked is who can open the route — and the answer was one line away in a file I had opened that day for something else." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T08:37:00Z",
    "why_it_governs": "The governing methodology must be in the tree and consulted at the moment of action.",
    "how_this_build_will_embody_it": "The nav file was in the tree and open. Consulting a file for one thing is not consulting it, which is the same shape as quoting one sentence of the KPI document." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-22T08:38:00Z",
    "why_it_governs": "Retrospective Identification from the record; detect patterns across incidents.",
    "how_this_build_will_embody_it": "The record is my own residual from an hour earlier, which named the failure, named the asset it violates, and named the fix. The build is that entry executed." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-22T08:39:00Z",
    "why_it_governs": "Outside-Perspective Identification, with no sunk cost in existing choices.",
    "how_this_build_will_embody_it": "Applied to a component I had written and tested hours before. The outside reading is that it should not exist — not that it should be moved — because the pager already was the rep's sub-nav." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-22T08:40:00Z",
    "why_it_governs": "Holistic — trace ripple effects; never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "The deletion broke exactly one thing and the gate named it. Four existing pager tests also broke, each encoding a two-page world, and each was rewritten to the new reality rather than around it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T08:41:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Four hypotheses before editing, and all four happened — the hard-coded halves, the stale `pageOf`, the slot order, and the orphan. The first two are invisible in jsdom, which is why they were written down before rather than found after." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-22T08:42:00Z",
    "why_it_governs": "External-config completeness.",
    "how_this_build_will_embody_it": "Does not bind: no config outside the repo. Stated rather than skipped." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-22T08:43:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2 rather than deferring as polish.",
    "how_this_build_will_embody_it": "The sheet specifies three tabs in an order. Building them somewhere the specified user cannot reach is the under-deliver half this clause names — reporting complete with the stated requirement unmet." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-22T08:44:00Z",
    "why_it_governs": "Diagnose before patching; trace interconnections before committing.",
    "how_this_build_will_embody_it": "The patch was 'move the tabs'. The diagnosis was that a second sub-nav should not exist, which is why a file was deleted rather than a route changed." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T08:45:00Z",
    "why_it_governs": "Append-only; the record stays intact.",
    "how_this_build_will_embody_it": "Applied to the record: the sweep's closure named this failure plainly and is not edited. This build closes its R1 by name." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-22T08:46:00Z",
    "why_it_governs": "Guide, don't overtake; the human's call stays the human's.",
    "how_this_build_will_embody_it": "The alternative fix — dropping `managerOnly` from My Progress — is a nav decision about who sees what, so it was not taken. Adding the board to the surface reps already have is a repair." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-22T08:47:00Z",
    "why_it_governs": "Hard metrics must be objective and defensible.",
    "how_this_build_will_embody_it": "Does not bind directly. Read because the Breakdown pane is where a rep's rubric averages now live, and 'defensible' includes being reachable by the person the number is about." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-22T08:48:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "The literal case: a board the rep cannot open is indistinguishable from one that was never built, and for nine days it was." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-22T08:49:00Z",
    "why_it_governs": "Validated against the alternative, not asserted.",
    "how_this_build_will_embody_it": "The pre-existing implementation — hard-coded halves — is encoded as two mutations, so the version that shipped yesterday is now a failing test rather than a memory." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-22T08:50:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "'/my-progress is the rep's progress page' arrived instantly from the route's NAME and was never checked against the nav. The name was accurate and the reachability was not." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T08:51:00Z",
    "why_it_governs": "Item 0: founder decisions go through a picker.",
    "how_this_build_will_embody_it": "One was avoided rather than taken: whether reps should see /my-progress is a nav decision, and the repair does not need it answered." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-22T08:52:00Z",
    "why_it_governs": "Verified is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md records that reachability:audit FAILED at 1 mid-build before reaching 0, because the failure is the evidence the gate works." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-22T08:53:00Z",
    "why_it_governs": "A decision returned as a verdict and consumed, never re-derived.",
    "how_this_build_will_embody_it": "`PAGES.length` is the authority for the geometry, consumed three times — track width, pane width, offset. The version this replaces had the same decision written as three literals." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-22T08:54:00Z",
    "why_it_governs": "Same-name-different-feature across modules; the user experiences a feature concept, not a module boundary.",
    "how_this_build_will_embody_it": "Two sub-navs with identical tabs on two routes is that failure waiting to happen — a rep and a manager would have called the same three words two slowly-diverging things. Deleting one is the remedy A21 asks for: unify rather than document the divergence." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-22T08:55:00Z",
    "why_it_governs": "Citing an asset without reading it in-session is A19 operating undetected.",
    "how_this_build_will_embody_it": "Sharpened by this build: I had READ A31 and cited it correctly in six consecutive builds while committing its failure. Reading is not the last gap; applying is." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T08:56:00Z",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "The nav file and the pager were both opened in full this time rather than grepped for one symbol." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-22T08:57:00Z",
    "why_it_governs": "Migrations are safe-to-re-run by construction.",
    "how_this_build_will_embody_it": "Does not bind: no migration." }
]
```
