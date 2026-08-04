---
tbc_version: 1
trigger: feature
started_at: 2026-08-04T00:11:02Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — After-Pitch "Your read" as a prominent button

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (build.md). Both in the working tree.

## 2. Why (§1.5.1 feature-workflow / L4 surface, founder directive 2026-08-04)
The founder reported that "Your read" (the rep's narrative debrief on the After-Pitch screen) was hard to find —
it rendered as a small, quiet text toggle (`CollapseToggle`), easy to miss against the rest of the card. On an
AMD-006 L4 surface a rep glances at between doors, a key section that's hard to see is a real workflow gap
(§1.5.1 layer 4 — the surface must match the substance). Directive: make it a button that's easily seen.

## 3. Design + interconnection (§1.5 ripple, §3.3)
`CollapseToggle` is shared (also used for "Score Assessment Review"). To avoid restyling every toggle, add an
OPT-IN `prominent` prop that renders a bold amber button (bulb icon + bold label + Tap-to-open/Hide hint +
glow), and pass it ONLY from the "Your read" toggle. Ripple: other `CollapseToggle` callers pass nothing →
unchanged. No data, API, scoring, or privacy change — purely presentational on the same section.

## 4. Behaviour preserved (§3.3)
Standard mode still auto-opens "Your read" (`defaultOpen`); Expert still collapses it; a no-narrative call still
omits it (`if (!narrative.hasSignal) return null`). Only the toggle's visibility changed, not when it shows.

## 5. Hypothesis
- **H1:** "Your read" now renders as a high-visibility amber button (collapsed shows "Tap to open"; open shows
  "Hide"); other toggles are visually unchanged; typecheck clean.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-04T00:11:02Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand the surface before changing it — read the Narrative/CollapseToggle + the Standard/Expert render sites.", "how_this_build_will_embody_it": "Section 2/4 describe the exact toggle and its three render states." },
  { "id": "§0.1", "read_at": "2026-08-04T00:11:02Z", "source_file": "CLAUDE.md", "line_range": "20-40", "why_it_governs": "Methodology in the tree, consulted this session.", "how_this_build_will_embody_it": "Doc integrity MATCH." },
  { "id": "§1.5", "read_at": "2026-08-04T00:11:02Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Ripple — CollapseToggle is shared; a naive restyle would hit other toggles.", "how_this_build_will_embody_it": "Opt-in `prominent` prop; only 'Your read' passes it; others untouched." },
  { "id": "§1.5.1", "read_at": "2026-08-04T00:11:02Z", "source_file": "CLAUDE.md", "line_range": "78-110", "why_it_governs": "Layer-4 surface — the presentation must match the substance; a hard-to-find key section is a real gap.", "how_this_build_will_embody_it": "The prominent button makes the section findable at a glance." },
  { "id": "§3.3", "read_at": "2026-08-04T00:11:02Z", "source_file": "CLAUDE.md", "line_range": "270-282", "why_it_governs": "Guide, don't overtake — do the founder's ask without smuggling behaviour changes.", "how_this_build_will_embody_it": "Section 4: auto-open / collapse / no-signal behaviour all preserved." },
  { "id": "§1.5.2", "read_at": "2026-08-04T00:11:02Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search — a shared component change needs a sweep of its other callers before restyling.", "how_this_build_will_embody_it": "Swept CollapseToggle usages; made the change opt-in so 'Score Assessment Review' is untouched." },
  { "id": "§6", "read_at": "2026-08-04T00:11:02Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "Understood the surface, ripple-traced the shared toggle, preserved behaviour, verified by render." },
  { "id": "A19", "read_at": "2026-08-04T00:11:02Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology must live in the tree.", "how_this_build_will_embody_it": "Confirmed present before citing." },
  { "id": "A22", "read_at": "2026-08-04T00:11:02Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + Session-Reads trailer." },
  { "id": "A30", "read_at": "2026-08-04T00:11:02Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "The `prominent` prop carries a comment citing the founder request + why it's opt-in." },
  { "id": "A38", "read_at": "2026-08-04T00:11:02Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes the typecheck result + the rendered mock." }
]
```
