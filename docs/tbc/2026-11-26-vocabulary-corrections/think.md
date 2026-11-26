---
started_at: 2026-11-26T01:16:28Z
trigger: Gong ledger F8.9 "Custom vocabulary" (P2, PARTIAL) — Gong also maps known mis-transcriptions per term; ours only biases transcription.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Known mis-hearings in the transcription vocabulary

## What the record shows

0306: a company's terms are sent to speech-to-text as keyterms (opt-in, 20% surcharge). Every transcript line is stored
through two writers in salesCoach.ts (appendTranscriptSegment, replaceSessionTranscript) and transcriptTextForStorage
(number redaction, D15); the typed line-correction route also uses it. A name the provider still mis-hears stays wrong
in search, trackers and AI reads.

## Design

- 0354: corrections jsonb on the same append-only row: [{term, heard[]}].
- vocabulary.ts: parseVocabularyLines ("Term = heard, heard"), normaliseCorrections (≤50 chars, ≤5 words, ≤10 per
  term, not the term, one term per mis-hearing), applyCorrections (whole words/phrases, any case, longest first),
  readCompanyCorrections (never throws).
- Both writers: corrections (cached 5 min per session) applied before redaction; the typed line correction is left as typed.
- Route: GET returns corrections (select *, so a pre-0354 table still reads); PUT validates each against the terms.
- Screen: one box, same parser; a parse error shows and Save waits.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "The ledger gap (F8.9: Gong maps known mis-transcriptions) was read against our two transcript writers: biasing with keyterms helps the provider, but a name that still comes out wrong stays wrong in search and trackers.",
    "how_this_build_will_embody_it": "Mis-hearings are replaced at the same two writers that already redact numbers."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:18:48Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "Holistic: the writers sit under every live call; a new read per line, or a read that throws, would slow or lose lines.",
    "how_this_build_will_embody_it": "A five-minute per-session cache, and any failure stores the line as heard (tested)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "Layer 3: an admin must see a mistake (a mis-hearing claimed by two names) before saving, not after every call.",
    "how_this_build_will_embody_it": "The screen parses with the server's rules and holds Save until it reads."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "Adjacent: the GET named its columns, so a pre-0354 table would fail the read; the PUT would fail with a corrections column missing.",
    "how_this_build_will_embody_it": "GET selects *, and PUT sends corrections only when there are any."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "The vocabulary's keyterms go to the speech-to-text provider; the corrections don't (they're applied here), so no new provider config.",
    "how_this_build_will_embody_it": "0354 is the only precondition, applied before the push."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "The settings screen and the server must agree on what a line means; two parsers would drift.",
    "how_this_build_will_embody_it": "The screen uses parseVocabularyLines and normaliseCorrections, the same functions the server validates with."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "A vocabulary change is a new row (0306); stored transcript lines are not rewritten.",
    "how_this_build_will_embody_it": "corrections ride on the appended row; only new lines are corrected."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "Erasure deletes transcript lines in every version; a corrected line is still a transcript line and is erased the same way.",
    "how_this_build_will_embody_it": "No new stored copy of customer words."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "The admin decides which names are corrected; the system invents no corrections.",
    "how_this_build_will_embody_it": "Only what an admin lists is replaced; a person's typed line correction is stored as typed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision: the ledger's named gap, opt-in per company."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests for parsing, whole-word replacement, the writer, and a failed lookup."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:18:48Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
