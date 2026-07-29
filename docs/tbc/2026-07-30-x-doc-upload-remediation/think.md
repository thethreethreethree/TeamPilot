---
tbc_version: 1
trigger: fix
started_at: 2026-07-30T01:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 3
---

# THINK — remediate the doc-upload audit findings (F2, F3, F5 fix; F1, F4 decline)

A formal audit (founder Prompt 2) of the doc-upload build (da4868a2) surfaced 5 findings across two
passes. This remediation fixes the three that warrant it and declines the two whose gate would be noisy.

## 1. Document integrity (§0.1) — MATCH

sha256 + wc of CLAUDE.md (e08874…, 429) and ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json.

## 2. The findings (audited from the built files, not memory)

- **F5 (MEDIUM, §1.5.1 layer 3):** extraction capped at 500k while the editor + save cap at 100k → a
  large doc fills the editor with text the Save button disables. Workflow dead-end.
- **F3 (MEDIUM, A27):** the extract route (function-body upload) advertised 15MB, but Vercel serverless
  bodies cap ~4.5MB → a promise the platform rejects before the code runs, with an opaque error.
- **F2 (LOW):** decodeEntities decoded `&amp;` before the named entities → `&amp;lt;` double-decoded to
  `<` instead of staying `&lt;`.
- **F1 (MEDIUM-class/LOW-practical):** archive entry fully decompressed before the char cap (zip-bomb);
  bounded by the manager-gate + platform memory + self-tenant.
- **F4 (LOW):** lenient UTF-8 decode accepts a binary file renamed .txt as garbage.

## 3. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-30T01:35:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Diagnose before patching — each finding was read out of the built file (cap constants, decode order, byte cap) before the fix, not from memory of writing them.", "how_this_build_will_embody_it": "Section 2 cites file:line evidence from the built code." },
  { "id": "§0.1",   "read_at": "2026-07-30T01:35:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the working tree, verified this session.", "how_this_build_will_embody_it": "Integrity MATCH; this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-30T01:35:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "F5 IS a layer-3 failure — the feature works in itself (extracts) but breaks workflow continuity (Save disabled). Layer 3 is the sieve the small-fixture tests passed through.", "how_this_build_will_embody_it": "F5 fix aligns the extraction cap to the field cap so Save always accepts the result." },
  { "id": "§1.5.2", "read_at": "2026-07-30T01:35:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Two passes — the cross-module pass (extraction cap ↔ save cap) caught F5, which the within-module pass missed.", "how_this_build_will_embody_it": "The audit ran both passes; F5 is the Pass-2 find." },
  { "id": "§6",     "read_at": "2026-07-30T01:35:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Interrogate the constraint — the Vercel body limit (F3) is a REAL constraint; respect it (lower the cap to what works) rather than pick the lock (advertise 15MB the platform rejects).", "how_this_build_will_embody_it": "F3 lowers the cap to 4MB, under the platform limit, so the promise is enforceable." },
  { "id": "A19",    "read_at": "2026-07-30T01:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree.", "how_this_build_will_embody_it": "This-session reads recorded." },
  { "id": "A22",    "read_at": "2026-07-30T01:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "Commit uses Session-Reads Form A." },
  { "id": "A26",    "read_at": "2026-07-30T01:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-715", "why_it_governs": "Each finding is one instance of a class; I swept each to its repo-wide boundary before fixing (grep loadAsync / &amp; / function-body upload).", "how_this_build_will_embody_it": "check.md records the sweep command + that my extractText is the sole instance of each class." },
  { "id": "A27",    "read_at": "2026-07-30T01:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "720-734", "why_it_governs": "F3 IS A27 — a surface promising an invariant (15MB) the write path can't enforce (platform rejects it). The fix enforces the invariant below the label (a cap the platform honors).", "how_this_build_will_embody_it": "The advertised cap (4MB) now equals what the write path can accept." },
  { "id": "A30",    "read_at": "2026-07-30T01:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A fix is not complete until the class is gated — F2 + F5 get unit gates that fail on recurrence.", "how_this_build_will_embody_it": "extractText test: '&amp;lt;'→'&lt;' (F2), MAX_EXTRACTED_CHARS ≤ 100k + a >cap doc is trimmed (F5)." },
  { "id": "A31",    "read_at": "2026-07-30T01:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-817", "why_it_governs": "Reachability — the F5 fix must actually make the seam (upload→editor→Save) traversable; the gate proves the extracted text fits the field.", "how_this_build_will_embody_it": "build.md asserts the write→read path of each fix." },
  { "id": "A33",    "read_at": "2026-07-30T01:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "850-869", "why_it_governs": "F1 (zip-bomb) + F4 (binary-as-text) have NO precise detector without false positives — jszip exposes no public per-entry size cap, and 'is this text' is a heuristic. Declining the gate honestly beats a noisy one.", "how_this_build_will_embody_it": "F1/F4 gate DECLINED with the hole named; F5's lowered cap partially bounds F1's blast." },
  { "id": "A38",    "read_at": "2026-07-30T01:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a claim about a named command actually run — the remediation closes only after the canonical gate passes.", "how_this_build_will_embody_it": "closure.md pastes npm run check output + exit code." }
]
```

## 4. Hypotheses

```json
[
  { "id": "H1", "claim": "Aligning MAX_EXTRACTED_CHARS to the 100k field cap removes the F5 dead-end without regressing normal uploads.", "confidence": "high", "test": "gate: a >cap doc extracts to ≤100k; small docs unaffected (existing 11 tests).", "outcome": "CONFIRMED — 13/13 tests; a 300k doc caps at 100k, truncated fires." },
  { "id": "H2", "claim": "Decoding &amp; last fixes the double-decode without breaking normal entity decoding.", "confidence": "high", "test": "gate: '&amp;lt;'→'&lt;'; '&amp;'→'&' still works (existing html test).", "outcome": "CONFIRMED — F2 gate + the existing 'Ben &amp; Jerry'→'Ben & Jerry' test both pass." },
  { "id": "H3", "claim": "F1 (zip-bomb) has no clean gate via jszip's public API, so declining is the honest A33 outcome; the 4MB input cap partially bounds it.", "confidence": "medium", "test": "confirm jszip exposes no public per-entry uncompressed-size cap; confirm the input cap reduces max decompression.", "outcome": "CONFIRMED — jszip's uncompressedSize is a private _data field; async decompresses fully. Declined + residual; the 4MB cap (F3) shrinks the input, and the manager-gate makes exploitation self-tenant." }
]
```

## 5. Spec fidelity + four-layer

Remediation only — no redesign (a remediation that grows into a refactor is the same failure). Each fix
is the minimal change that enforces the invariant below the label. Layer 3 (F5) is the load-bearing one:
the fix restores workflow continuity (upload → fills → Save accepts). **verdict: SHIPPABLE.**
