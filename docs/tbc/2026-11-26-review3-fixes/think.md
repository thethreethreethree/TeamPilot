---
started_at: 2026-11-25T23:57:10Z
trigger: Independent review of 181b459f..19d07354 (0348, 0349, 0350, invariant 43, question markers) — five findings.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the third review

## What the review found, from the record

1. Two HIDE_ROUTE_ALLOWLIST reasons were false. delete-recording and save-recording read the call with the service
   role (route.ts, the `admin.from("coaching_sessions")` read) and checked only company + role: no reporting-tree check
   (0273) and no hidden-call check (0337). A manager outside a rep's chain, or one a phrase hides the call from, could
   delete or save its audio by id. Root cause: the allowlist was written from memory of the routes, not from reading
   them — the reason text described the safe sibling pattern (getSession first) the routes do not use.
2. Invariant 43 looked at three tables only, so a route serving a call's AI reads or notes through the service role
   without touching those three would pass. Cause: the table list was taken from the first seven routes the review-1
   fix touched, not from the hide migrations (0339/0341), which cover 20+ tables.
3. 0350 dropped the company pin from the task-event scrub but not from the signals scrub beside it.
4. Score (`pitch:`) events are never erased — pre-existing, a founder decision (0285 excludes retyped notes).
5. The question list's "Play from here" buttons stay live with no recording; seek() then does nothing.
6. Nit: `_` in 0348/0349's LIKE patterns matches any character; no subject collides today.

## Design

- Both routes: for a caller who is not the call's rep, ask treeAllowsRep and hiddenFrom (the database's own rules);
  unreachable → the same 404 as another company's call; a failed check → 500, nothing changed.
- Invariant 43: every call table under 0337/0339/0341, plus events about a call; each newly matched route read and
  listed with its real reason; the two fixed routes leave the list (the audit flags a stale entry).
- 0351: 0350's body with the signals scrub keyed by source alone.
- Questions without a recording render as text with a one-line reason.
- (4) goes to the founder as a picker; (6) recorded, not changed.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "The false allowlist reasons are the symptom; the cause is that they were written without reading the routes. Fixing the text alone would leave the same write path open.",
   "how_this_build_will_embody_it": "Each route was read before its reason was written; the two that were unsafe are fixed, not re-described."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
   "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line at 2026-11-25T23:57:40Z, after started_at."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "64-76", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "Holistic: a widened audit touches every service-role route; a signals change touches the one erasure door.",
   "how_this_build_will_embody_it": "Nine newly matched routes read one by one; 0351 diffed against 0350 (one line)."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-100", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "Layer 3: a button that does nothing is a dead end; layer 2: an access check that is not asked does not work.",
   "how_this_build_will_embody_it": "Route tests for tree/hidden/failed-check; a render test for a call with no recording."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "Search adjacent: if two reasons were false, the audit's scope was likely too narrow too.",
   "how_this_build_will_embody_it": "The audit now uses the hide migrations' own table list, and the production count of misfiled task signals was probed (0)."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-180", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "No configuration outside the repository is involved.",
   "how_this_build_will_embody_it": "None needed; 0351 applied and its live body checked."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "The tree and hidden verdicts are computed by rss_tree_allows / rss_call_hidden_for; a route must consume them, not re-derive.",
   "how_this_build_will_embody_it": "The routes call treeAllowsRep and hiddenFrom and branch on the returned verdict."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "Events and signals are append-only; only the erasure door may change them, and only for the erased customer's data.",
   "how_this_build_will_embody_it": "0351 changes only the erasure function's own scrub condition; no other path writes signals."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-361", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "Item 2: erasure must reach stored text derived from the customer's call, wherever it was filed; item 5: one door.",
   "how_this_build_will_embody_it": "The signals scrub now reaches a misfiled callback signal (replayed before/after); the function stays single and registered in ERASURE_EXTENSIONS."},
  {"id": "§3.3", "source_file": "CLAUDE.md", "line_range": "368-378", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "Whether a rep's score notes are erased is the founder's call, not mine.",
   "how_this_build_will_embody_it": "Score events are asked as a picker with a recommendation, not changed."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "450-456", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "Checklist item 0: a decision for the founder must be a picker with the recommendation first.",
   "how_this_build_will_embody_it": "The score-events question goes to AskUserQuestion."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "Methodology in the working tree, consulted not remembered.",
   "how_this_build_will_embody_it": "Assets printed by line this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "A citation without a session read is the failure this build is repairing in miniature: allowlist reasons cited a pattern the routes did not follow.",
   "how_this_build_will_embody_it": "Every reason in the widened list names what the route actually does, read today."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "Invariant 43 widened to the hide migrations' tables; erasureCoverage pins 0351's scrub."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-11-25T23:57:40Z",
   "why_it_governs": "Verified is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md names npm run check, the replay and the live probes with their outputs."}
]
```
