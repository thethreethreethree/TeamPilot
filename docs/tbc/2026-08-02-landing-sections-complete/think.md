---
tbc_version: 1
trigger: feature
started_at: 2026-08-02T23:01:45Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — Elostate landing: remaining sections (Problem → Footer)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (build.md). Both in the working tree.

## 2. Why (§1.5.1 feature-workflow, founder directive)
Completes the founder's emotional arc after the already-shipped hero + differentiator (3de15872): Problem
(dramatize the pain) → Turn (the answer: sharper, not dependent) → How it works (understand/guide/grow) →
Modules (breadth) → [Differentiator] → Proof (prove it in your data) → Close (final CTA) → Footer. Each section
maps to the founder's message hierarchy and reuses the robust `Reveal`.

## 3. Design + interconnection (§1.5 ripple, §3.4 honesty)
- **Arc/colour logic:** Problem is red-tinted tension; the Turn pivots to yellow warmth; the rest carries the
  yellow brand. Deliberate emotional shape, not decoration.
- **Honesty in Proof (§3.4):** the stat tiles are honest STRUCTURAL facts (4 tools→1, 2-month proof window,
  measured-on-your-data) — NOT fabricated customer results. Testimonials are visibly-labelled PLACEHOLDERS
  ("[Name], [Role]" + a "real quotes drop in here" note) so nothing fake reads as real.
- **Method fidelity:** How-it-works = understand→guide→grow (the §1 Living-Diagnosis loop); the Proof month-1/
  month-2 framing = the §3.4 baseline-then-intervention design. The page states the real thesis, not marketing
  fiction.
- **Ripple:** still preview-only (`/landing-preview`); live page.tsx untouched; landing-only tokens/font.

## 4. Robustness (§5, A26)
Every new section reveals via the same `Reveal` (content ships visible, JS only arms). The one JS-driven number
(`CountUp`) renders its FINAL value in SSR and only animates 0→value on scroll-in — no-JS/reduced-motion shows
the real number. No section hides content on JS failure.

## 5. Hypothesis
- **H1:** all 9 sections render in the real Next build (typecheck clean, server 200, each section's copy present
  in SSR HTML), on-brand and robust; live page.tsx unchanged.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-02T23:01:45Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand the method before dramatizing it — the page must state the REAL thesis.", "how_this_build_will_embody_it": "How-it-works = understand/guide/grow; Proof = the honest baseline-then-lift design." },
  { "id": "§0.1", "read_at": "2026-08-02T23:01:45Z", "source_file": "CLAUDE.md", "line_range": "20-40", "why_it_governs": "Methodology in the tree, consulted this session.", "how_this_build_will_embody_it": "Doc integrity MATCH." },
  { "id": "§1.5", "read_at": "2026-08-02T23:01:45Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Ripple — a marketing page must not destabilize the app.", "how_this_build_will_embody_it": "Preview route only; landing-only tokens; live page untouched." },
  { "id": "§1.5.1", "read_at": "2026-08-02T23:01:45Z", "source_file": "CLAUDE.md", "line_range": "78-110", "why_it_governs": "Feature-workflow continuity — the arc must lead to a clear next action.", "how_this_build_will_embody_it": "Repeated Request-access CTA (hero, close, footer) → /redeem; See-it-work → differentiator." },
  { "id": "§3.4", "read_at": "2026-08-02T23:01:45Z", "source_file": "CLAUDE.md", "line_range": "292-306", "why_it_governs": "Honesty is the moat — no fake proof.", "how_this_build_will_embody_it": "Stat tiles are structural facts; testimonials are labelled placeholders; Proof states the real month-1/2 design." },
  { "id": "§3.3", "read_at": "2026-08-02T23:01:45Z", "source_file": "CLAUDE.md", "line_range": "270-282", "why_it_governs": "Guide, don't overtake — founder reviews before the live swap.", "how_this_build_will_embody_it": "Still a preview route; page.tsx unchanged." },
  { "id": "§5", "read_at": "2026-08-02T23:01:45Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Distrust the confident answer; verify by rendering.", "how_this_build_will_embody_it": "Each section render-checked; SSR-content presence confirmed by curl." },
  { "id": "§6", "read_at": "2026-08-02T23:01:45Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist.", "how_this_build_will_embody_it": "Understood, ripple-traced, honesty-checked, verified." },
  { "id": "A19", "read_at": "2026-08-02T23:01:45Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology must live in the tree.", "how_this_build_will_embody_it": "Confirmed present before citing." },
  { "id": "A22", "read_at": "2026-08-02T23:01:45Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + Session-Reads trailer." },
  { "id": "A30", "read_at": "2026-08-02T23:01:45Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "CountUp + Reveal + Proof comments state the robustness + honesty contracts." },
  { "id": "A38", "read_at": "2026-08-02T23:01:45Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes typecheck + server-200 + SSR-content grep." }
]
```
