---
started_at: 2026-11-26T01:50:19Z
trigger: Independent review of 3186ba56 + ee466a7a (reporting tree) — one confirmed high (role changes could switch the tree off), one confirmed medium (calibration 500s for large companies), two plausible.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the review of the reporting-tree fixes

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "The review traced the team route's POST: it sets any company member's Sales Coach role with the service role after a bare manager check, so a tree-limited manager could make a member without a manager 'staff' — 0287 then counts the company as off the tree and every manager is widened.",
    "how_this_build_will_embody_it": "Role changes ask treeAllowsRep for the target (your own role excepted); the false allowlist reason is removed so the audit enforces it."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T02:07:41Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "Holistic: my calibration paging capped at 5,000 rows, and the paging helper throws at the cap — every large company got a 500; its session lookup put thousands of ids in one URL and ignored the error.",
    "how_this_build_will_embody_it": "A bounded scan (10 pages of 500, stop at 500 kept), lookups in chunks of 150, every error a 500."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "Layer 2: an empty team page after a failed tree check reads as 'no data'.",
    "how_this_build_will_embody_it": "treeFilterRepsChecked returns null on failure; the four team views say degraded/500."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "Adjacent: OFFSET paging over a live table can repeat a call that arrived mid-scan.",
    "how_this_build_will_embody_it": "The session list skips an id it already kept."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "The tree is the database's rule (0273/0287); production has 0 manager links, so nothing was exposed.",
    "how_this_build_will_embody_it": "No outside config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "Who may be acted on is the tree's verdict; the role route re-decided it as 'same company'.",
    "how_this_build_will_embody_it": "The route consumes treeAllowsRep."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "Read-path and authorization changes only; profiles' role updates are as before for allowed targets.",
    "how_this_build_will_embody_it": "No new write path."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "No customer text is touched by these changes.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "An honest 'couldn't load' instead of a silent empty team.",
    "how_this_build_will_embody_it": "Degraded/500 on a failed tree check."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision: managers still assign roles within their own team."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "No citation without a session read — and no allowlist reason without reading the route: the team entry described GET, not POST.",
    "how_this_build_will_embody_it": "Removed; the audit now requires the tree check on the route."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Invariant 36 now covers the team route; tests for the refusal and the degraded list."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T02:07:41Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
