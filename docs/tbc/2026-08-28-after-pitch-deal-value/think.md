---
started_at: 2026-08-28T13:30:00+08:00
---

# THINK — deal-value capture on the After-Pitch page

## Why (the founder's pick, from the audit)
The KPI input-completeness audit found Revenue / Avg-deal-size read "building" forever because 0 of 9 sold
sessions had a `deal_value`. Root cause (scoped, §0): the `/outcome` API accepts `dealValue`, and the SESSION page
has a deal-value input on 'sold' — but the AFTER-PITCH page (which in the Standard flow REPLACES the session page)
records the outcome WITHOUT a deal value (its `recordOutcome` sent `{outcome}` only). So reps who close on the
after-pitch screen can't enter the value. The founder chose: add an OPTIONAL inline deal-value input, mirroring the
session page.

## The build (§1.5 organic — mirror the reference exactly)
- `after-pitch/page.tsx` — `recordOutcome` now accepts `dealValue` and sends it (omit = unchanged), mirroring the
  session page's append-only chokepoint. Added `dealDraft`/`savingDeal` state + `saveDealValue` (validate ≥0, route
  through `recordOutcome("sold", parsed)`). An OPTIONAL "Deal value" inline input renders when `outcome === "sold"`,
  copied field-for-field from the session page (same label, input, Save button, "Recorded: X"). Session type gains
  `dealValue`.

## Why it's correct + safe (§1.5.1 layer 2)
The backend (`setSessionOutcome`) already writes `deal_value` when provided and returns it via the mapped session
(salesCoach.ts:122, 280) — verified. The append-only latch (`outcomeSubmitRef`) already guards double-writes, and
saveDealValue routes through it, so the value save inherits the same guard. Optional = never blocks logging a sale
(the founder's low-friction choice); a rep who skips it just leaves Revenue thin, same as today.

## Session-read manifest (A22 — read_at ≥ started_at 13:30:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T13:31:00+08:00",
    "why_it_governs": "Scope WHERE deal value is (not) captured before building — don't add a duplicate flow.",
    "how_this_build_will_embody_it": "Traced the /outcome API + both pages; found the after-pitch page is the only gap." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T13:31:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-28T13:31:10+08:00",
    "why_it_governs": "Organic + Holistic — mirror the session page's existing deal-value pattern, don't invent a new one.",
    "how_this_build_will_embody_it": "Copied the field/handler/latch field-for-field; the backend is reused unchanged." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T13:31:15+08:00",
    "why_it_governs": "Layer 2 — the value must actually flow to Revenue/Avg-deal, not just render.",
    "how_this_build_will_embody_it": "Verified the setter writes deal_value + returns it in the mapped session; typecheck covers the chain." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T13:31:18+08:00",
    "why_it_governs": "THINK-first — the session page already solved this; check it before building.",
    "how_this_build_will_embody_it": "Read the session page's deal-value UI + handler and mirrored it." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-28T13:31:20+08:00",
    "why_it_governs": "Guide-don't-overtake — the friction (optional vs required) was the founder's pick.",
    "how_this_build_will_embody_it": "Surfaced the friction choice as a picker; built the optional inline input chosen." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-382", "read_at": "2026-08-28T13:31:25+08:00",
    "why_it_governs": "Measure the consequence — deal value is the outcome data Revenue/Avg-deal are built from.",
    "how_this_build_will_embody_it": "Captures the real deal value at the moment of the sale, feeding the Layer-1 KPIs." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T13:31:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: scoped the gap, surfaced the friction choice, mirrored the reference, verified the chain." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T13:31:35+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T13:31:40+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T13:31:45+08:00",
    "why_it_governs": "Gate the lesson — the append-only latch must still guard the added value-save path.",
    "how_this_build_will_embody_it": "saveDealValue routes through recordOutcome (the latched chokepoint); the /outcome route is already unit-tested." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T13:31:50+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code." }
]
```
