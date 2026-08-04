---
tbc_version: 1
trigger: feature
started_at: 2026-08-04T00:33:37Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — After-Pitch "Your read" shows on every session

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (build.md). Both in the working tree.

## 2. Why (§1.5.1 L4 consistency, founder directive 2026-08-04)
The founder wants "Your read" present on EVERY after-pitch, not only calls that clear the review's content gate.
Today the `Narrative` component hides itself entirely when the sales review returns no signal
(`if (!narrative.hasSignal) return null`) — which happens on thin/test calls (the review needs ≥3 rep turns,
`salesReview.ts` MIN_AGENT_SEGMENTS). Result: the section vanishes, which reads as "missing feature" to the rep.

## 3. Design + interconnection (§3.4 honesty is the moat)
Remove the hide gate: the "Your read" section ALWAYS renders. When there IS a narrative → the real read (strengths
+ opportunities). When there ISN'T (a call too thin to review) → an HONEST short state ("this call was too short
to read yet; run a full pitch and it lands here"). This satisfies "show it every time" WITHOUT fabricating a read
from too little — the §3.4 honesty gate becomes a visible-but-honest state instead of a silent hide. No change to
the review engine, the scores, or the ≥3-turn quality floor (that's flagged as a tunable, not touched here).

## 4. Ripple (§1.5)
Only the `Narrative` render in the after-pitch page changes (drop one early-return, add one empty-state block).
The API, `salesReview.ts` threshold, scoring, and privacy are untouched. Standard still auto-opens, Expert still
collapses. On a truly empty call (no segments at all → whole summary EMPTY) the page still shows its top-level
empty state — that degenerate case is unchanged.

## 5. Hypothesis
- **H1:** "Your read" now renders on every after-pitch that shows a summary — the real read when there's content,
  an honest short state when the call was too thin; typecheck clean; other behaviour unchanged.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-04T00:33:37Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand WHY it was hidden (the ≥3-turn honesty gate) before changing it.", "how_this_build_will_embody_it": "Section 2/3 trace the gate to salesReview.ts and keep the honesty, just made visible." },
  { "id": "§0.1", "read_at": "2026-08-04T00:33:37Z", "source_file": "CLAUDE.md", "line_range": "20-40", "why_it_governs": "Methodology in the tree.", "how_this_build_will_embody_it": "Doc integrity MATCH." },
  { "id": "§1.5", "read_at": "2026-08-04T00:33:37Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Ripple — don't disturb the review engine or scores.", "how_this_build_will_embody_it": "Section 4: only the Narrative render changes." },
  { "id": "§1.5.1", "read_at": "2026-08-04T00:33:37Z", "source_file": "CLAUDE.md", "line_range": "78-110", "why_it_governs": "L4 surface consistency — a key section that vanishes reads as a broken feature.", "how_this_build_will_embody_it": "The section is now always present and consistent." },
  { "id": "§1.5.2", "read_at": "2026-08-04T00:33:37Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "Trace the real cause of the hide before acting.", "how_this_build_will_embody_it": "Found the exact gate (salesReview MIN_AGENT_SEGMENTS → narrative.hasSignal → null)." },
  { "id": "§3.3", "read_at": "2026-08-04T00:33:37Z", "source_file": "CLAUDE.md", "line_range": "270-282", "why_it_governs": "Founder directive; do it without weakening honesty.", "how_this_build_will_embody_it": "Always-render, honest empty state; the ≥3-turn quality floor stays (flagged as a tunable)." },
  { "id": "§3.4", "read_at": "2026-08-04T00:33:37Z", "source_file": "CLAUDE.md", "line_range": "292-306", "why_it_governs": "Honesty is the moat — never fabricate a read from too little.", "how_this_build_will_embody_it": "Thin calls show an honest 'too short' state, not an invented review." },
  { "id": "§6", "read_at": "2026-08-04T00:33:37Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist.", "how_this_build_will_embody_it": "Diagnosed the gate, ripple-traced, preserved honesty, verified." },
  { "id": "A19", "read_at": "2026-08-04T00:33:37Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology must live in the tree.", "how_this_build_will_embody_it": "Confirmed present." },
  { "id": "A22", "read_at": "2026-08-04T00:33:37Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + Session-Reads trailer." },
  { "id": "A30", "read_at": "2026-08-04T00:33:37Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "A comment states why the section always renders + where the ≥3-turn floor lives." },
  { "id": "A38", "read_at": "2026-08-04T00:33:37Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes the typecheck result." }
]
```
