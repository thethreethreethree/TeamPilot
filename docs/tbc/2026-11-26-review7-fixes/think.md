---
started_at: 2026-11-26T01:24:27Z
trigger: Independent review of 9de5fda2 (vocabulary corrections) — four confirmed ways a line could be rewritten wrongly, a round-trip gap, a cached failure.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the review of vocabulary corrections

Production holds 0 vocabularies (count), so no stored line was affected.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "The review reproduced each rewrite against the real functions; the causes are a missing part-of-a-term check, sequential replacement, a string replacement pattern, and the order against redaction.",
    "how_this_build_will_embody_it": "Each cause is removed (refusal, one pass, function replacement, redaction first) and pinned by a test reproducing the review's case."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:25:52Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "Holistic: moving corrections after redaction changes what a correction may match — the redaction marker itself.",
    "how_this_build_will_embody_it": "Mis-hearings that match inside '[number removed]' are refused."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "Layer 2: a feature that corrupts correctly heard names fails its intended result on every line.",
    "how_this_build_will_embody_it": "No mis-hearing that is part of a listed name can be saved."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "Adjacent: the screen's round trip dropped duplicate entries and split commas.",
    "how_this_build_will_embody_it": "Entries merge by name; '=' and ',' are refused in names and mis-hearings."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "No configuration outside the repository; production holds 0 vocabularies, so nothing stored needs repair.",
    "how_this_build_will_embody_it": "Checked by count."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "'Couldn't read' and 'none set' were one value, so a failure was cached as 'none'.",
    "how_this_build_will_embody_it": "readCompanyCorrections returns null on failure; only answers are cached."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "Stored transcript lines are never rewritten; only new lines get corrections.",
    "how_this_build_will_embody_it": "No stored row changes."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "Redaction protects customers' numbers; a correction must never undo it.",
    "how_this_build_will_embody_it": "Redaction runs first; number-only mis-hearings are refused."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "An admin's list must not silently change what people said beyond the names they meant.",
    "how_this_build_will_embody_it": "Whole-word, one pass, and refusals with the reason shown on the screen."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Each reviewed case is a test; the writer tests cover redaction order and an uncached failure."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:25:52Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
