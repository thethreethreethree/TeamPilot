---
tbc_version: 1
trigger: fix
started_at: 2026-07-28T13:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: cc9071abd15ab7e06c3e89fef38f66da0b9df351ffa2afde50ec3d4664ef1d92
manifest_entries: 13
hypotheses: 2
---

# THINK — F2 fix: citation regex requires the section sign

The **first real post-install TBC build** — the protocol governing its own tooling. Fixes
finding F2 (filed in docs/residuals/OPEN.md): `scripts/tbc/lib.mjs` treated bare `A<n>` as a
constitutional citation, so ordinary prose ("A4 paper", "A100 GPU", "Figure A3", "grade A1")
was flagged, and any future artifact containing such prose would go spuriously red — a noisy
gate (A33) that breaks a build for a non-reason, and disagreement with the established
commit-msg hook on the same concept (A21).

## 1. Document integrity

Hashes match docs/tbc/DOC_MANIFEST.json (regenerated on the AMD-008 install this session).
Both governing documents present in the working tree.

## 2. Session-read manifest

```json
[
  { "id": "§0",     "read_at": "2026-07-28T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding precedes solving — the fix rests on understanding WHY the false positives occur (bare-A alternation), not just silencing them.", "how_this_build_will_embody_it": "The diagnosis names the exact regex alternation and why it over-matches, before the change." },
  { "id": "§0.1",   "read_at": "2026-07-28T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "The methodology must be read this session, not cached; this manifest records the reads behind the fix.", "how_this_build_will_embody_it": "read_at timestamps are this session and line ranges are gate-verified." },
  { "id": "§1.5.1", "read_at": "2026-07-28T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four-layer framework — the fix is evaluated for structure (the regex), effectivity (does it still catch real citations), composition (agreement with the commit-msg hook).", "how_this_build_will_embody_it": "Section 4 walks the layers for a detection-logic change." },
  { "id": "§1.5.2", "read_at": "2026-07-28T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK before search — the fix was hypothesised (bare-A over-matches) then confirmed by test against a battery of real citations and false positives.", "how_this_build_will_embody_it": "The hypotheses below were tested before the regex was changed." },
  { "id": "§6",     "read_at": "2026-07-28T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "The quick decision checklist — this fix must not contradict any of its questions; in particular it aligns to a precedent rather than substituting a preference.", "how_this_build_will_embody_it": "The change matches the established commit-msg convention (precedent), not a personal quality bar." },
  { "id": "A19",    "read_at": "2026-07-28T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "625-648", "why_it_governs": "Methodology in the working tree — read live, recorded here.", "how_this_build_will_embody_it": "The manifest carries this-session reads gate-verified against the live files." },
  { "id": "A21",    "read_at": "2026-07-28T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "700-720", "why_it_governs": "Same-concept-different-behaviour across modules is the exact defect: citation detection existed with TWO behaviours (commit-msg requires the sign; the tbc lib matched bare A).", "how_this_build_will_embody_it": "The fix converges the two surfaces on the commit-msg behaviour." },
  { "id": "A22",    "read_at": "2026-07-28T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "764-800", "why_it_governs": "Citations without session-reading are undetected violations; the manifest gate is the mechanism, and this fix narrows its INPUT without weakening the minimum-set check.", "how_this_build_will_embody_it": "The minimum-set (A19/A22/A30/A38) stays enforced via declared ids, independent of extraction." },
  { "id": "A26",    "read_at": "2026-07-28T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "861-900", "why_it_governs": "A finding is an instance of a class; F2's class is 'regex over-matches ordinary prose', swept across the two citation-detection surfaces.", "how_this_build_will_embody_it": "The check sweeps for other bare-token over-matches in the tbc scripts." },
  { "id": "A28",    "read_at": "2026-07-28T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "907-924", "why_it_governs": "A precedent already in the codebase decides what looks like a design choice: the commit-msg hook's §A[0-9]+ form decides the citation shape.", "how_this_build_will_embody_it": "The fix follows that precedent rather than inventing a third convention." },
  { "id": "A30",    "read_at": "2026-07-28T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "940-962", "why_it_governs": "A fix is complete only when the class is closed at a point that fails without cooperation; here the regex IS the single chokepoint through which all citation detection flows.", "how_this_build_will_embody_it": "One regex, one place; there is no second site to drift." },
  { "id": "A33",    "read_at": "2026-07-28T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "1022-1050", "why_it_governs": "A gate must be precise or not exist — a noisy gate is one people learn to skip. F2 was precisely that noise (firing on A4/A100).", "how_this_build_will_embody_it": "The fix removes the imprecision at its source rather than allowlisting each false positive." },
  { "id": "A38",    "read_at": "2026-07-28T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "1171-1200", "why_it_governs": "'Verified' is a claim about a command — the fix is confirmed by running the gates and pasting exit codes, not by asserting it works.", "how_this_build_will_embody_it": "build.md pastes npm run check output; the tbc gate re-run is in closure.md." }
]
```

## 3. Hypotheses before search

```json
[
  { "id": "H1", "claim": "Requiring the section sign for the asset form drops the false positives (A4/A100/A3/A1) while still catching every real §-citation.", "confidence": "high", "test": "Run extractCitations over a battery of real citations and false positives with both regexes.", "outcome": "CONFIRMED — real citations (§A26, §1.5.1, §6) still match; A4/A100/A3/A1 no longer match." },
  { "id": "H2", "claim": "The narrowed regex does not regress the install bootstrap, because that build's required citations are §-form and the minimum-set is checked via declared ids, not extraction.", "confidence": "high", "test": "Run all four gates against 2026-07-28-install-tbc-gates after the change.", "outcome": "CONFIRMED — all four gates exit 0 on the install dir after the change." }
]
```

## 4. Four-layer pre-walk

- **1 structure:** one regex, one chokepoint (extractCitations); the change removes a branch rather than adding logic. Defensible.
- **2 effectivity:** invoked as the gates invoke it, it still catches §A26 / §1.5.1 / §6 and drops A4 / A100. Confirmed by test (H1).
- **3 composition:** it converges the tbc lib onto the established commit-msg hook's citation shape — two surfaces, one behaviour now (closes the A21 split).
- **4 surface:** developer-facing gate output; a legitimate build.md mentioning "A4" no longer produces a spurious red.

**verdict: SHIPPABLE.**

## 5. Specification fidelity

- Restated: narrow CITATION_RE so bare `A<n>` is not a citation, matching the commit-msg hook.
- As written, not a cleaner version: the change is the minimal one that follows the existing precedent.
- Conflicts/ambiguities: none — the precedent (commit-msg §A form) decides the shape (A28). The residual trade-off (a bare "A26" someone *intended* as a citation is no longer caught) is worked in closure.md and matches the commit-msg hook's own limit.
