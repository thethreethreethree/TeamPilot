---
started_at: 2026-09-22T06:00:00+08:00
trigger: Two founder directives from one picker — build the Metrics tab from the Macro spec that already exists, and do a density self-audit instead of a browser check.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the tab was describing something that already existed

## Why (the record)

I had recorded the Metrics tab as unbuildable: the sheet names it and never draws it, four content
pages and none of them is Metrics, so its contents were not something to infer. That reading was
right about the sheet and wrong about the product.

The founder's answer was to build it from the Macro spec that already exists, and opening
`TodaysMetricsPager` shows why that is not a compromise. It already pairs the Arena with
`doorlog/TodaysMetrics` under two labels:

```ts
const PAGES = [
  { key: "progress", label: "Progress" },
  { key: "metrics", label: "Metrics" },
] as const;
```

**Progress and Metrics.** The sheet's sub-nav was not specifying something new; it was describing
something the product had, with the same words, built to the founder's own 2026-08-19 spec. What
was missing was the third tab and the sub-nav on the rep dashboard, not a board.

That is the second time in three builds that reading a source dissolved the task rather than
completing it. The first — Clean sweep — changed what I built. This one changed whether there was
anything to build.

## What the density pass is, and what it is not

The founder chose a self-audit over a browser check, having been told what it cannot do. Worth
being precise about that rather than quietly treating it as equivalent: reading my own markup
cannot tell me what a page LOOKS like. It can tell me what the page SAYS, and whether any of it is
untrue, redundant, or about something the reader cannot see.

It found one of those. The board's rule line ended *"; equal totals share a place."* That explains
ranking, and the 2026-09-22 ruling removed every rank a rep can see — so for a rep it described a
mechanic they will never encounter, on a card already carrying four other lines.

That is the shape worth naming: **a behaviour change removes a value, and the copy that explained
it stays.** Nothing fails. The sentence is still true of the system; it is just no longer true of
the reader. Only reading the screen as a whole finds it, which is precisely what this pass was.

## The one thing the tabs must not do

Three boards behind three tabs, each fetching on mount. Rendering all three and hiding two with CSS
is the shorter implementation, looks identical on screen, and triples the requests for a rep who
opened one tab. Invisible in a screenshot, obvious in a network tab — so it is a mutation rather
than a comment.

## Session-read manifest

```json
[
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-22T06:02:00Z",
    "why_it_governs": "Guide, don't overtake: default to proposing and explaining rather than silently deciding, and never take a call that belongs to the human.",
    "how_this_build_will_embody_it": "Both halves of this build came from a picker rather than from me. The Metrics tab's contents were the founder's call after I had recorded that I could not infer them, and the density pass is the founder's choice of method over the one I would have picked." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T06:03:00Z",
    "why_it_governs": "The governing methodology must be in the working tree and consulted at the moment of action.",
    "how_this_build_will_embody_it": "`TodaysMetricsPager` was opened rather than remembered, and its PAGES constant is the whole answer — the sheet's two labels, already in the code. I had described that file twice from its filename and its route." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-22T06:04:00Z",
    "why_it_governs": "A user-specified experience is the intended result and binds at layer 2 rather than deferring as layer-4 polish.",
    "how_this_build_will_embody_it": "The sheet specifies three tabs. The product had two boards stacked and no third, which is a layer-2 gap rather than a presentational one — the rep could not reach a surface the design says they have." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T06:05:00Z",
    "why_it_governs": "Four layers, foundation up; a feature that works in itself but breaks workflow continuity is incomplete.",
    "how_this_build_will_embody_it": "Layer 3 is the whole reason for tabs over a stack: three boards down one page means scrolling past two to reach the third, with the Breakdown's thirty percentages in the middle. The order — where you stand, then why, then the field read — is the same argument." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-22T06:06:00Z",
    "why_it_governs": "Consume the verdict; never re-derive a decision an authority already judged.",
    "how_this_build_will_embody_it": "The Metrics panel renders the EXISTING component rather than a Pitch Score reimplementation of it. A second field-read board would be a second definition of what a day's metrics are, and the two would drift." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-22T06:07:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "Inverted here, and that is the density finding: a sentence the reader cannot act on is worse than one they cannot see, because it costs them attention to discover it is irrelevant." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T06:08:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm; audit adjacent surfaces proactively.",
    "how_this_build_will_embody_it": "The density pass IS this clause run deliberately rather than as a side effect. The hypothesis before reading: a behaviour change made hours earlier will have left copy behind. It had." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T06:01:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The problem was not 'the Metrics tab has no spec'. It was that the sheet's sub-nav was describing the product rather than prescribing it, which is only visible once both are open." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-22T06:09:00Z",
    "why_it_governs": "Retrospective Identification from the record; detect patterns across incidents.",
    "how_this_build_will_embody_it": "The pattern across three builds: reading the source changed the task twice and dissolved it once. The record is my own closures saying so each time." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-22T06:10:00Z",
    "why_it_governs": "Outside-Perspective Identification.",
    "how_this_build_will_embody_it": "Applied to the density pass, which is the stance the exercise requires: read the card as somebody who did not write any of its five lines and has no attachment to why each was justified." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-22T06:11:00Z",
    "why_it_governs": "Holistic — trace ripple effects before acting.",
    "how_this_build_will_embody_it": "Restructuring the page touches three components that each fetch on mount. Traced to the decision that only one panel mounts, and to the check that the page remains a server component so its exports still work." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-22T06:12:00Z",
    "why_it_governs": "External-config completeness.",
    "how_this_build_will_embody_it": "Does not bind: no config outside the repo. `TodaysMetrics` reads a route that already exists and already works." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-22T06:13:00Z",
    "why_it_governs": "Ground-up auditing; a flag low down is leveraged more than one at the top.",
    "how_this_build_will_embody_it": "INVARIANT 27 is the low flag here: a `useState` in the page file would have made it a client component and silently killed any route segment config it exports. The tabs live one level down for that reason." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-22T06:14:00Z",
    "why_it_governs": "Diagnose before patching; trace interconnections before committing.",
    "how_this_build_will_embody_it": "The density finding was diagnosed rather than deleted: the sentence is still true for a manager, so it became conditional rather than being removed, which is the difference between reading the screen and tidying it." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T06:15:00Z",
    "why_it_governs": "Append-only; state is derived rather than edited.",
    "how_this_build_will_embody_it": "Does not bind to the tabs. Stated because the milestone strips on the Progress panel are the one place it does: both derive their dates, and the Arena's derive from the immutable ledger so they cannot move." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-22T06:16:00Z",
    "why_it_governs": "Hard metrics must be objective and defensible.",
    "how_this_build_will_embody_it": "Bears on the Metrics tab's contents: doors, conversations and sales are the hard metrics §3.5 names, and reusing the existing component keeps one definition of each rather than a second set computed from pitches." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-22T06:17:00Z",
    "why_it_governs": "Validated against the alternative, not asserted.",
    "how_this_build_will_embody_it": "The alternative implementation — mount all three panels, hide two — is encoded as a failing mutation rather than argued against in a comment." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-22T06:18:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "I wrote into check.md that the Metrics panel now sits under a second period control from the Arena. Checked before shipping it: the Arena has none. A confident observation about a screen I had not opened, in the document recording a pass about reading screens carefully." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T06:19:00Z",
    "why_it_governs": "Item 0: founder decisions go through a picker with a recommendation.",
    "how_this_build_will_embody_it": "Both directives came from one. The guard had to fire first — my previous message listed three founder decisions in prose — which is the enforcement working on me rather than on a hypothetical." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T06:20:00Z",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is encoded in a gate.",
    "how_this_build_will_embody_it": "Eleven mutations gate the behaviour. The class the density pass belongs to — copy left behind by a behaviour change — has no gate and cannot have one, since the sentence stays syntactically valid and semantically true." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-22T06:21:00Z",
    "why_it_governs": "Schema-complete is not built; the seam between the data and the surface.",
    "how_this_build_will_embody_it": "Applied to navigation rather than data: a board nobody can reach is the same failure as a table nothing reads. The Metrics component existed, worked, and was reachable from one route only." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-22T06:22:00Z",
    "why_it_governs": "Verified is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the run with its exit code, reports 11-of-11, and says plainly that the density pass was a read of my own markup and cannot find a layout problem." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-22T06:23:00Z",
    "why_it_governs": "A decision returned as a verdict and consumed, never re-derived.",
    "how_this_build_will_embody_it": "The tie sentence is gated on `managerView` — the route's verdict — rather than on whether a rank happens to be present in the payload, which would be a second read of the same access decision." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-22T06:24:00Z",
    "why_it_governs": "Same-name-different-feature across modules; the user experiences a feature concept, not a module boundary.",
    "how_this_build_will_embody_it": "The opposite outcome for once: 'Metrics' in the sheet and 'Metrics' in TodaysMetricsPager turned out to BE the same feature. Checking prevented a second board rather than revealing two." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-22T06:25:00Z",
    "why_it_governs": "Citing an asset without reading it in-session is A19 operating undetected.",
    "how_this_build_will_embody_it": "I had described TodaysMetricsPager twice from its filename and its route — 'a different board, the 2026-09-04 Macro spec' — without opening it. Accurate, and it omitted the one line that answered the question." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T06:26:00Z",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Both the sheet and the existing component were opened. The standing exception is unchanged: the 2026-09-19 instruction image still cannot be." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-22T06:27:00Z",
    "why_it_governs": "Migrations are safe-to-re-run by construction.",
    "how_this_build_will_embody_it": "Does not bind: no migration." }
]
```
