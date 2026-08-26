---
started_at: 2026-08-27T06:22:00+08:00
---

# THINK — View-session authz-review fixes + drift guards

## Why (the record — the authz review I ran on the view-session fix)
An adversarial security review of the view-session routes came back CLEAN on tenant isolation / authz (two barriers:
canManagerViewRepSkills same-company + the query double-scoped on the caller's company; §A18 compliant). It surfaced
two honesty/UX items, both in the "monitor usage" surface, plus a rate-limit consistency nit:

1. **F1 (§3.4 honesty)** — if `team-activity` errors, the roster showed "No sessions" for EVERY rep — a failure dressed
   as "nobody's using it," in the exact surface whose job is monitoring usage. FIX: an `activityLoaded` flag set ONLY
   on a successful load; a pending/failed aggregate leaves the annotation blank (unknown), never the false-empty copy.
2. **F2 (low)** — rep-activity caps at 100 with no "showing most recent" note (implying completeness for a very active
   rep). FIX: the route returns `atCap`/`cap`; the header reads "Most recent 100 sessions" when capped.
3. **rate-limit nit** — team-activity lacked the rateLimit its siblings have. FIX: added (30/min), consistent with
   rep-activity + /recordings.

## Structural guards (A30 — the gap my view-session TBC flagged as "no pure seam")
Added source-drift guards (the codebase's existing grep-the-source pattern):
- rep-activity: MUST NOT re-add the audio filter; MUST stay scoped by company_id + agent_id; MUST keep the manager
  authz (isSalesCoachManager + canManagerViewRepSkills). Locks the exact bug class the founder reported.
- team-activity: MUST be manager-gated + scoped to the caller's OWN company_id (its only tenant defense).

## Ripple (§6 item 5)
Small honesty/consistency fixes on the two new routes + the manager view + two test files. No authz change (the review
confirmed it sound); the fixes only make failures honest and cap-truthful. Typecheck clean; drift + parse tests pass.

## Session-read manifest (A22 — read_at ≥ started_at 06:22:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T06:24:02+08:00",
    "why_it_governs": "Act on the review findings from the record, verified against the code.",
    "how_this_build_will_embody_it": "Fixed the two confirmed honesty/UX items; left the clean authz unchanged." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T06:24:20+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-92", "read_at": "2026-08-27T06:24:06+08:00",
    "why_it_governs": "Layer 2 — the monitoring surface must actually deliver an honest usage read, including on failure.",
    "how_this_build_will_embody_it": "F1 keeps a failed aggregate from claiming 'nobody uses it'; F2 keeps the list honest about the cap." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "144-146", "read_at": "2026-08-27T06:24:12+08:00",
    "why_it_governs": "Proactive audit — act on what the review confirmed; don't ship a false-empty in the monitoring surface.",
    "how_this_build_will_embody_it": "F1 makes an aggregate failure honest; added drift guards so the class can't regress." },
  { "id": "§A18", "source_file": "ThinkerThinker.md", "line_range": "431-432", "read_at": "2026-08-27T06:24:10+08:00",
    "why_it_governs": "Usage surfaced to a leader must stay activity, never a ranking.",
    "how_this_build_will_embody_it": "The review confirmed the roster is unsorted activity; these fixes touch only honesty/cap, never a rank." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T06:24:08+08:00",
    "why_it_governs": "Honesty — a failed aggregate must not read as 'nobody is using it'.",
    "how_this_build_will_embody_it": "activityLoaded gates the annotation; a failure shows blank (unknown), never 'No sessions' for all." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T06:24:22+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: acted on verified review findings, honest failure state, gated the lesson with drift guards." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-456", "read_at": "2026-08-27T06:24:24+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-08-27T06:24:26+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-771", "read_at": "2026-08-27T06:24:28+08:00",
    "why_it_governs": "Gate the lesson — the view-session TBC noted 'no pure seam'; this fills it.",
    "how_this_build_will_embody_it": "Source-drift guards lock: no audio filter, company+agent scoping, manager authz, company-scoped aggregate (8 tests)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-08-27T06:24:30+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
