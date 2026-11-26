---
started_at: 2026-11-26T07:20:00Z
trigger: Independent review of 7158345a..5afe7782 — one high (stale brief answers), one medium, several low.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the review of shared streams and brief templates

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "An independent review of 7158345a..5afe7782 traced three brief-template defects: the page showed the newest STORED run, not the current transcript's, so after a trim an answer could keep quoting the trimmed words with no way to refresh; a cut-off or unparseable reply was stored as 'Not discussed' for every question; a run returning after a template switch showed under the wrong template. Plus coverage shares for trackers with too few calls in scope, case-sensitive folder lookup, and small route issues.",
    "how_this_build_will_embody_it": "Each fixed at its cause, with tests."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T10:17:48Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "Holistic: trims, line corrections and relabels make a new transcript version and re-run the call brief; custom briefs are on-demand, so the reader must be the one to follow the version.",
    "how_this_build_will_embody_it": "GET reads only the current version's run; the call can be briefed again after any change."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "Layer 2: 'Not discussed' for every question after a truncated reply is a confident false claim and blocks a re-run.",
    "how_this_build_will_embody_it": "A reply that isn't a usable answer list stores nothing (null), so the person can run it again; the token budget raised to 2000 for 8 questions."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "Adjacent: path saves matched names case-sensitively while the move guard compares without case — two rules for one name.",
    "how_this_build_will_embody_it": "The lookup compares trimmed, lower-cased names in code."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "No migration and no outside configuration.",
    "how_this_build_will_embody_it": "No config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "The current transcript version is one verdict (loadLines), shared by the run and now the read.",
    "how_this_build_will_embody_it": "Both use loadLines' version."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "Nothing is edited; an older run stays on record and simply isn't shown for a newer transcript.",
    "how_this_build_will_embody_it": "Append-only unchanged."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "Answers can quote the customer; erasure matches the call's company, so an answer must be filed under it.",
    "how_this_build_will_embody_it": "custom_briefs.company_id = the call's company, not the caller's."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "Honesty: never tell a manager a call didn't discuss something because the model's reply was cut off.",
    "how_this_build_will_embody_it": "Failed reads are said as failures."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "A share of one call says nothing; each tracker's share now needs MIN_CALLS calls it listens to.",
    "how_this_build_will_embody_it": "'only N calls it listens to — too few for a share'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: stale run hidden, truncated reply null, per-tracker minimum, case-insensitive reuse."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T10:17:48Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
