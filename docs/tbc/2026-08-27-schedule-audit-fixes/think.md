---
started_at: 2026-08-27T10:15:00+08:00
---

# THINK — schedule-system audit: the founder-directed fixes

## Why (the record — a 4-agent outside-view audit the founder chose)
The founder directed an outside-view audit of the Schedule Management System. Four focused agents (file-import,
AI assistant, mutation/event routes, export/render) plus my own foundation-layer + client-side passes ran the §1.5.2
lens set. The foundation verified SOLID (tenant isolation server-derived everywhere, append-only DB-enforced by
trigger+revoke and behaviorally proven, RQ6 manager-only defense-in-depth + drift-guarded, no 1000-row truncation,
CWE-209 clean, CSV/XLSX injection closed, no UTC-day bug, the assistant double-fenced). Every finding was VERIFIED
against the code before acting (audit-finding-is-a-suspect) — one agent finding (triplicated-set drift) was REFUTED by
an existing `managerOnlySync.test.ts`. I surfaced the two judgment-dependent items to the founder as pickers (§3.3
guide-don't-overtake), and the founder directed this fix set.

## The fixes (§1.5 organic/holistic — minimal, each verified)
- **A — colour export dropped split shifts (§3.4 + §1.5.4).** The founder's *specified* colour export (a user-specified
  experience = layer-2, §1.5.4) rendered only the LATER of two same-day shifts, silently, and disagreed with the CSV.
  Root cause: `buildWeekGrid` was last-wins (gridView.ts) vs `buildExportGrid` earliest-wins. Fix (founder chose "show
  both"): the cell now carries ALL segments earliest-first; the canvas AND screen grid render every one, so a split
  shift is never hidden. The re-importable CSV stays one-per-cell + its collapse warning (round-trip constraint), but
  the colour path now shows the full truth, so they no longer contradict.
- **B — import grid OOM (§1.5.1 layer 2 + §3.4).** `parseScheduleGrid` emits rows × headerDates with no row cap → a
  large paste explodes to ~200M entries → OOM. Fix: `MAX_GRID_ROWS` (1000) with a graceful 413 at both routes (never a
  silent truncation).
- **C + D — authority verdict not enforced at the write boundary (§2.2).** The authority marks double-booking /
  approved-time-off / over-hours / ineligible as ABSOLUTE (`overridable:false`), but `events/route.ts` POST never
  consumed the verdict — a manager could write an impossible assignment (the §2.2 verdict-computed-but-not-consumed
  class, one level up). Fix (founder chose "enforce"): the write path runs `evaluateChange` for EMPLOYEE_ASSIGNED /
  SWAP_APPROVED and rejects an absolute violation (422), while STILL allowing overridable cases (coverage/unavailable —
  the manager's warned-not-forbidden override is untouched). It also existence-checks the ids first (Finding D —
  evaluateChange treats a phantom shift/employee as approvable, so a stale/foreign id would inflate coverage).
- **F4 — manager GET returned empty-200 to a non-manager (§3.4).** A permission denial dressed as "the schedule is
  empty". Fix: the full-log GET is gated on isAdmin → an honest 403.
- **Assistant empty-LLM honesty (§3.4).** An empty/starved model reply was rendered as "try rephrasing" — blaming the
  manager for a server-side hiccup. Fix: an empty response reports an honest system problem; a non-empty-unparseable
  reply keeps the rephrase guidance.
- **Latent precondition documented (Agent 3 F2).** The employee-open event types don't bind `payload.employeeId` to the
  caller — correct today (manager-entered model), but a ⚠ precondition comment now marks exactly where the caller-binding
  MUST be added when staff self-service ships (per the founder's "document it" choice).

## Deferred (surfaced, not silently skipped — §3.3): xlsx column amplification, base64-cap misstatement, PDF non-Latin
name encoding, printed-colour unassigned warning, GET rate-limit — all LOW, recorded in closure R1 for later.

## Gate (A30) — every fix has a test that fails without it
Import cap (413 route test), authority enforcement (422 double-booking / 409 phantom / 201 clean + GET 403), assistant
empty→honest, split-shift keeps both segments earliest-first. Renderer pixels aren't unit-tested (canvas), but the
MODEL layer that carried each bug is locked.

## Session-read manifest (A22 — read_at ≥ started_at 10:15:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T11:44:00+08:00",
    "why_it_governs": "Understand each finding from the record before fixing.",
    "how_this_build_will_embody_it": "Every fix followed a code-verified finding, not an agent claim taken on faith." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T11:44:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session (11:44)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-08-27T11:44:10+08:00",
    "why_it_governs": "Retrospective — findings came from reading the actual routes/lib + the design doc, and one was refuted.",
    "how_this_build_will_embody_it": "Verified each suspect against the code; refuted the triplicated-set drift via an existing test." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-27T11:44:15+08:00",
    "why_it_governs": "Organic + Holistic — minimal fixes, traced ripple (the shared cell shape across two renderers).",
    "how_this_build_will_embody_it": "Each fix is scoped; the split-shift change updates both consumers of the cell so neither drifts." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "89-92", "read_at": "2026-08-27T11:44:20+08:00",
    "why_it_governs": "Layer 2 — the import must actually handle a large file, and the colour export must deliver the real schedule.",
    "how_this_build_will_embody_it": "Import returns a graceful 413 not an OOM; the colour export shows every shift." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "150-152", "read_at": "2026-08-27T11:44:25+08:00",
    "why_it_governs": "Proactive audit — the whole exercise; hypothesis-first per lens, confirmed against code.",
    "how_this_build_will_embody_it": "Four lens-scoped agents + my passes; only verified findings acted on." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-200", "read_at": "2026-08-27T11:44:30+08:00",
    "why_it_governs": "The colour export is a user-SPECIFIED experience → layer-2, not waivable polish; silent data-loss on it is a real defect.",
    "how_this_build_will_embody_it": "Fixed the split-shift loss on the founder's specified colour export as a layer-2 requirement." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-316", "read_at": "2026-08-27T11:44:35+08:00",
    "why_it_governs": "The authority verdict must be CONSUMED, not computed-and-ignored — the exact §2.2 shape of Finding C.",
    "how_this_build_will_embody_it": "The write path now branches on evaluateChange's verdict; a drift test exercises block + allow." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-27T11:44:40+08:00",
    "why_it_governs": "Guide-don't-overtake — the judgment-dependent items are the founder's decision, not mine.",
    "how_this_build_will_embody_it": "Surfaced enforce-vs-warn + the colour approach + fix-scope as pickers; built only what the founder chose." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-367", "read_at": "2026-08-27T11:44:45+08:00",
    "why_it_governs": "Honesty — no silent data-loss, no permission-denial-as-no-data, no system-error-as-user-fault.",
    "how_this_build_will_embody_it": "Colour export shows both shifts; GET 403s honestly; assistant reports an honest system problem." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T11:44:50+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: verified findings, surfaced decisions, gated each fix." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-27T11:45:00+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-27T11:45:05+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-27T11:45:10+08:00",
    "why_it_governs": "Gate the lesson — a prose-only fix returns.",
    "how_this_build_will_embody_it": "Import cap, authority enforcement, GET 403, assistant honesty, split-shift each carry a failing-without-it test." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-27T11:45:15+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + EXIT code." }
]
```
