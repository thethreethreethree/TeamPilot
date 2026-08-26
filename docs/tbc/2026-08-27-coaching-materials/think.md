---
started_at: 2026-08-27T05:16:00+08:00
---

# THINK — Coaching materials library (pending item 3)

## The ask
Founder pending list: "a library of coaching materials to read alongside the live practice." Rather than a manual CMS,
generate a short coaching guide per SKILL from the company's OWN methodology (corpus) — one guide per skill a rep is
working on = a library grounded in the team's playbook, no content management.

## The build (reuse the corpus LLM path; §3.4 honest fallback)
- `coachingMaterial.ts` — `buildMaterialSystemPrompt(corpus)` (teach from THIS team's method) + parse →
  {overview, keyMoves[], watchOuts[], exampleLines[]}; null on malformed / nothing-teachable so the caller shows an
  honest "couldn't load", never a fabricated guide.
- Route `coaching-material` (POST, authed, company-scoped, rate-limited 20/min, maxDuration 60, CONVERSATION_IS_DATA
  fenced) → dissectCoachV5 + corpus → {material} | {material:null}.
- Training tab: each of the rep's focuses gains a "Learn" button (beside "Practice") that expands an inline guide,
  fetched on first open. Read alongside the live practice.

## Injection posture
New LLM route: imports + appends CONVERSATION_IS_DATA, exports maxDuration, auth+company gated (invariant-audit rules).

## Ripple (§6 item 5)
New module + route + a Learn toggle on FocusItem (its own fetch state). The practice/scored-review paths are unchanged.
Best-effort generation (null → honest "couldn't load") so the tab never breaks.

## Session-read manifest (A22 — read_at ≥ started_at 05:16:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T05:20:02+08:00",
    "why_it_governs": "Understand the corpus path + the founder's 'read alongside practice' intent before building.",
    "how_this_build_will_embody_it": "Reused the corpus LLM path; the guide sits beside Practice on the same focus." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T05:20:04+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Cited axioms re-read this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-87", "read_at": "2026-08-27T05:20:06+08:00",
    "why_it_governs": "Layers 2 + 4 — a real, grounded guide that reads clearly inline.",
    "how_this_build_will_embody_it": "Overview / key moves / watch-outs / example lines, expandable per focus; honest empty." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-163", "read_at": "2026-08-27T05:20:08+08:00",
    "why_it_governs": "THINK the constraint — a new LLM route must carry the fence + maxDuration.",
    "how_this_build_will_embody_it": "CONVERSATION_IS_DATA appended, maxDuration exported, auth+company gated." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T05:20:14+08:00",
    "why_it_governs": "Honesty — no fabricated guide.",
    "how_this_build_will_embody_it": "parseCoachingMaterial null on malformed / nothing-teachable → honest 'couldn't load'; a test locks it." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T05:20:16+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: reused the path, fenced + gated the route, honest fallback, gated the parse." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-456", "read_at": "2026-08-27T05:20:20+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-08-27T05:20:22+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-771", "read_at": "2026-08-27T05:20:24+08:00",
    "why_it_governs": "The honest-fallback rule would rot in prose unless a test fails when the parser stops returning null on empty output.",
    "how_this_build_will_embody_it": "parseCoachingMaterial honesty (null on malformed / nothing-teachable, array caps) is unit-locked (5 tests)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-08-27T05:20:26+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
