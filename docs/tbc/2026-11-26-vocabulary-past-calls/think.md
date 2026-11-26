---
started_at: 2026-11-26T08:45:00Z
trigger: Founder picker 2026-11-26 — vocabulary corrections on past calls: "On request, with a count" (ledger F8.9).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Fix past calls with the vocabulary's corrections

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Founder picker 2026-11-26 (\"On request, with a count\"): a company's 'heard as' corrections fixed new lines only, so past calls kept the wrong names in transcripts, search and AI notes.",
    "how_this_build_will_embody_it": "An admin checks how many past calls would change, then fixes them in batches; each fixed call's AI notes are redone."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T12:44:48Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Holistic: a corrected transcript must flow to everything derived from it — trackers, stats, briefs, summaries — the way a trim does; and must not clobber a newer edit, trim or relabel.",
    "how_this_build_will_embody_it": "A new transcript version (0368) then generateSessionArtifacts (trackers and AI reads); refused when the version moved on."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Layer 3: the admin sees the count and the AI cost before anything is written, and confirms.",
    "how_this_build_will_embody_it": "'N calls (M lines) would change … one AI pass per call' → confirm → 'Fixed N'."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Adjacent: the apply step must use exactly the rule new lines use, or past and future calls disagree.",
    "how_this_build_will_embody_it": "planReapply calls applyCorrections."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "0368 applied in production; verify:live 33/33 (run on its own after the apply step hung under load); the function exercised in a rolled-back transaction (3/3).",
    "how_this_build_will_embody_it": "db:apply, verify:live, the probe."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "The current transcript is one verdict (the highest version); the function refuses when it isn't the one read.",
    "how_this_build_will_embody_it": "p_from_version check."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Lines are never edited in place.",
    "how_this_build_will_embody_it": "Each fix is a new version; the old one stays as history."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; the new version is a transcript version, which erasure already deletes in every version.",
    "how_this_build_will_embody_it": "coaching_transcript_segments is erased by session (all versions)."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "The admin decides when to spend; the system counts and asks.",
    "how_this_build_will_embody_it": "Count first; confirm."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Honesty about cost: each fixed call is a paid AI pass, said before.",
    "how_this_build_will_embody_it": "The count names it; batches of 50."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Checklist item 0: the decision came through a picker with a recommendation first.",
    "how_this_build_will_embody_it": "Built as chosen."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "No citation — and no allowlist reason — without reading the route: both allowlist entries name the guard and why.",
    "how_this_build_will_embody_it": "Written from the route as built."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: count writes nothing; fix from the current version; stale skipped; the screen."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T12:44:48Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
