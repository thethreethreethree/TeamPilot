---
started_at: 2026-11-26T03:17:25Z
trigger: Found planning the win/loss tracker breakdown: listProspects capped at 500 with unchunked follow-up reads.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The pipeline reads every prospect

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "Planning the tracker breakdown showed listProspects reading .limit(500) newest prospects, then putting all their ids in one .in() for to-dos and deal sentiment. Every pipeline view — totals, forecast, calendar, Ask Pipeline, win/loss — sits on it.",
    "how_this_build_will_embody_it": "Paged with a unique order; every follow-up read in chunks of 150."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T03:18:44Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "Holistic: six callers (prospects, calendar, changes, day, pipeline-link, askPipeline) share listProspects; fixing it once fixes all of them.",
    "how_this_build_will_embody_it": "One change in the shared reader; dealSentiment chunked with it."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "Layer 2: a pipeline that silently drops its oldest deals gives wrong totals and win rates.",
    "how_this_build_will_embody_it": "Every prospect is read; a failed read is still null (never a short list)."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "Adjacent: removing the cap makes the unchunked .in() reads the next failure.",
    "how_this_build_will_embody_it": "to-do links, to-dos and sentiment links all chunked."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "No configuration outside the repository; production holds 0 prospects, so nothing was cut yet.",
    "how_this_build_will_embody_it": "Checked by count."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "The pipeline's numbers are derived from the one list; a capped list re-decided 'which deals exist'.",
    "how_this_build_will_embody_it": "The list is complete."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "Prospects are derived from append-only events (remote_prospects_current); this only changes how many are read.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "Erasure renames erased prospects (0316/0323); reading more rows shows no erased text.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "The rep's whole pipeline, as they built it.",
    "how_this_build_will_embody_it": "No silent cut."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A test: 600 prospects all returned, no limit, ordered by id last."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T03:18:44Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
