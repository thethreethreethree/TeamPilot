---
started_at: 2026-09-01T09:04:00+08:00
---

# THINK — wire the missing quota-target control (Quota KPI can finally activate)

## Why (the record + a live workflow dead-end)
Resolving the KPI crisis, I flagged that the **Quota** metric stays "building" until a company sets a monthly
deals-won target. Tracing the workflow (§1.5.1 layer 3): the SET endpoint
`PATCH /api/coach/sales-session/quota` **exists and is manager-gated**, but a repo-wide grep for its path in
`.tsx` returns **zero UI callers**. So a manager was told "set a target to activate Quota" — with **no control in
the product to do it**. Quota could never leave "building" through the UI. That is the exact "endpoint built,
never wired" / "feature technically complete but breaks workflow continuity" failure §1.5.1 exists to catch — a
silent dead end, not a founder-input gap.

## Understanding (§0 — this is a WIRING gap, not a compute gap)
The compute (`quotaAttainment`) and the mutation route are both correct and tested. The ONLY missing piece is the
surface that lets a manager provide the number. No new engine, no schema change: an inline manager-only editor in
the Team section (already manager-gated by `team !== null`) that PATCHes the existing route, then refreshes.

## Four-layer trace (§1.5.1)
- **L1 structure:** reuse the existing route + existing `teamQuotaTarget` state; extract the `/team` fetch into a
  `loadTeam(initial)` callback so it can be re-run after a save (no duplicated fetch logic).
- **L2 effectivity:** a manager types a target → PATCH → on success the value persists and Quota computes. Client
  validation mirrors the server Zod bound **term-for-term** (`int`, `1..100000`, or blank→null to clear).
- **L3 continuity (the whole point):** on save, re-run BOTH `loadMe` (headline Quota, from `/me`) AND
  `loadTeam(false)` (per-rep Quota columns, from `/team`) so nothing lags on "building" until a manual reload.
  `initial` gates the one-time default-to-company scope so a quota refresh doesn't yank a manager out of "Mine".
- **L4 surface:** three honest states — unset shows "Quota is off until you set a target" + a **Set target**
  button; set shows the value + **Edit**; editing shows an input with Save/Cancel, Enter/Escape, and inline errors
  (403 non-manager, 409 migration-pending, generic).

## Honesty (§3.4)
No fabricated number. Clearing the field sets the target to null → Quota honestly returns to "building". A 409
(migration 0206 not applied) surfaces "not enabled on this environment", never a fake success.

## Verification (A38)
`npm run typecheck` clean + eslint clean on the page (pasted in check.md). The mutation route is already covered
by its own route test; the client control has no render harness (founder-visual-verify, as with the rest of this
page) — stated, not asserted-green.

## Session-read manifest (A22 — read_at ≥ started_at 09:04; each read THIS session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-01T09:18:00+08:00",
    "why_it_governs": "Understand WHY before building — this was diagnosed as a wiring dead-end (grep found 0 UI callers), not a compute gap.",
    "how_this_build_will_embody_it": "Confirmed the route exists + is unwired before writing a single line of the control." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-01T09:18:20+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md + the cited ThinkerThinker axioms re-opened this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-105", "read_at": "2026-09-01T09:16:00+08:00",
    "why_it_governs": "Four-layer gate — the dead-end is a layer-3 continuity break; the fix must leave the manager in a flowing state.",
    "how_this_build_will_embody_it": "Traced all four layers; on save both the headline and per-rep Quota refresh so nothing stalls on 'building'." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-01T09:18:40+08:00",
    "why_it_governs": "THINK-first + search — the finding came from proactively grepping the SET route's callers, not from a founder report.",
    "how_this_build_will_embody_it": "The unwired endpoint was found by auditing the Quota gap I surfaced, then confirmed with a grep." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-01T09:19:30+08:00",
    "why_it_governs": "Honesty — never fabricate a metric value; a missing target must read as honest 'building', not a guess.",
    "how_this_build_will_embody_it": "Clearing the field sets target=null → Quota returns to 'building'; a 409 surfaces 'not enabled', never a fake success." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-01T09:17:00+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from the record, traced the workflow, reused the route, kept honesty on the null/409 states." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-01T09:04:00+08:00",
    "why_it_governs": "Methodology in the working tree, not cited from cache.",
    "how_this_build_will_embody_it": "Re-opened A19 this session before citing it." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-601", "read_at": "2026-09-01T09:04:30+08:00",
    "why_it_governs": "Citations require session-reading.",
    "how_this_build_will_embody_it": "This manifest pairs each cited § with a read_at; the commit carries a Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-01T09:05:00+08:00",
    "why_it_governs": "Gate the lesson — a fix in prose alone recurs.",
    "how_this_build_will_embody_it": "The client validation mirrors the server Zod bound term-for-term; the route's own test is the durable guard." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-01T09:18:50+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes typecheck + eslint; the client control's un-tested half is named founder-visual-verify, not asserted." }
]
```
