---
started_at: 2026-08-28T07:50:00+08:00
---

# THINK — honest "blocked" state for the 2 uncomputable KPI tiles (Task 3, part 4)

## Why (the founder's pick + the §3.4 defect)
After building objections + recommendation uptake, the KPI page had 2 tiles left — Sales cycle length and
Follow-up rate — both BLOCKED (they need prospect-identity tracking across visits, which the data model doesn't
capture). They still rendered "building…", which is a §3.4 dishonesty: "building" implies the number is on its
way once enough sessions land, but for these it NEVER is. The founder chose: honesty-relabel them.

## The build (§1.5.1 layer-4 presentation, §3.4 honesty)
- `page.tsx` — the `Metric` type gains an optional `blocked?: string`. A blocked metric renders that reason
  ("needs prospect tracking") in a muted/italic state with a title tooltip, NOT "building…". The CSV export writes
  the reason too (not "building"). Sales cycle + Follow-up rate are marked `blocked: "needs prospect tracking"`.
- The stale top-of-file comment (which still listed Objections/Sales-cycle as "building") is corrected.

## Honesty (§3.4) — the whole point
"building" is a promise the data is accruing; a blocked metric makes no such promise. The relabel makes the page
tell the truth: this number needs a capability we don't have yet, distinct from a wired metric still gathering
its sample. Same honesty class as the presentations fix earlier this session — a surface must not imply data it
can't produce.

## Scope
Presentation only — no route, no compute, no data change. The path to actually BUILDING these two is prospect-
identity capture (a separate, larger founder pick; residual).

## Session-read manifest (A22 — read_at ≥ started_at 07:50:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T07:51:00+08:00",
    "why_it_governs": "Understand WHY the tiles can't compute before relabelling — a blocked metric is a data-model gap, not a sample gap.",
    "how_this_build_will_embody_it": "The relabel states the real reason (needs prospect tracking), distinct from 'building'." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T07:51:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T07:51:10+08:00",
    "why_it_governs": "Layer 4 — the surface must match the substance; a false 'building' is a surface that lies.",
    "how_this_build_will_embody_it": "The tile now honestly signals not-available rather than coming-soon." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T07:51:15+08:00",
    "why_it_governs": "THINK-first — the neighbours (the now-built tiles) made the 2 blocked ones stand out as the remaining lie.",
    "how_this_build_will_embody_it": "Swept the layers; only the 2 truly-uncomputable tiles get the blocked state." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T07:51:20+08:00",
    "why_it_governs": "Honesty — never imply a number is coming when it can't.",
    "how_this_build_will_embody_it": "'building' (promise) is replaced by 'needs prospect tracking' (honest not-available) for the 2 blocked tiles." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T07:51:25+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the block, relabelled only the truly-blocked tiles, kept scope to presentation." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T07:51:30+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T07:51:35+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T07:51:40+08:00",
    "why_it_governs": "A behavior worth trusting needs a guard proportionate to its risk — here the risk is a label regressing to a false 'building', which typecheck plus the explicit visual-verify note bound rather than a disproportionate render harness.",
    "how_this_build_will_embody_it": "Typecheck locks the blocked field + both branches; the rendered label is named as founder visual-verify, not silently assumed." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T07:51:45+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code." }
]
```
