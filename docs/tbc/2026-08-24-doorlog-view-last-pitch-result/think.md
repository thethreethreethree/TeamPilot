---
started_at: 2026-08-24T09:09:43+08:00
---

# THINK — "View last pitch result" button after ending a Door Log session

## The founder's ask (verbatim + clarification)
"Agents want an OPTIONAL feature to see their most recent session. Right now the session gets stored on
another page, so they can't see it immediately. Add a button that immediately accesses the result of their
pitch performance." Clarification (picker): **"the button needs to appear after they end a session."**

## Understanding — traced the workflow first (§0, §1.5.1 four layers)

Two Sales-Coach result flows exist; I traced BOTH before building (§1.5.1: trace before/after):

- **Regular sessions** (`/dashboard/sales-coach/[id]`): "End session" → required naming → `router.push('/[id]/after-pitch')`
  (page.tsx:254) — so ending a regular session ALREADY lands the rep on the result. **No gap here.**
- **Macro Door Log** (`/doors`, the door-to-door reps' flow — the founder said "pitch performance", the Macro
  term): `save()` is FIRE-AND-FORGET (DoorLog.tsx:419 "the rep returns to IDLE immediately") → the pitch's
  result processes async and lands on the SEPARATE Pitch Performance page (`/doors/report-card`). **This is the
  gap** — exactly "the session gets stored on another page, so they can't see it immediately."

So the feature is a **layer-3 workflow-continuity** fix (§1.5.1 layer 3 / §6 item 5a): after a rep ENDS a pitch,
the natural next action is "see how it went" — but the Door Log stalls them back at IDLE with no affordance to
the result. The button restores continuity.

## The design (four layers, foundation-up)

- **Layer 1 (structure):** the pitch id isn't returned by the fire-and-forget `save()`/`postDoorLog` (and keepalive
  means the POST may finish after unload), so capturing it there is fragile. Instead add a small server REDIRECT
  page `doors/report-card/latest/page.tsx` that resolves the newest pitch server-side (RLS-scoped, 1 row,
  `recorded_at desc limit 1`) and `redirect()`s to its detail. **Pivot during build (see build.md):** an earlier
  client `useRouter` + `/latest` API-fetch version would have added a navigation-hook dependency to the Door Log,
  breaking all 7 existing Door Log render tests — the redirect-page keeps the button a plain `<Link>`, no ripple,
  and gives a cleaner server-redirect (no client fetch / loading flash). `latest` is a static segment (never
  collides with a uuid pitch id; Next matches it ahead of the sibling `[pitchId]`).
- **Layer 2 (effectivity):** the button is a static `<Link>` to `/doors/report-card/latest` → the page redirects
  to that pitch's DETAIL — the full after-pitch result of the exact pitch they just ended, in ONE tap (the Pitch
  Performance nav tab can't: tab→list→find→tap = 3+ taps). No pitch / read error → the list (honest, never a dead end).
- **Layer 3 (composition):** appears in the Door Log IDLE state ONLY after a real pitch was saved this session
  (`justSavedPitch`, set in `save()`'s `.then` on `r.ok && !r.audioDropped` — a knock or a dropped-audio save has
  no result to view). Non-blocking: the normal IDLE UI + "Knock next door" are untouched, honoring the
  zero-waiting field flow. This is the "after they end a session" placement the founder specified.
- **Layer 4 (surface):** an optional, clearly-labelled affordance ("View last pitch result →"), styled as a
  secondary action so it never competes with the primary knock flow.

## Guide-don't-overtake (§3.3)
Optional + non-blocking — the rep uses it "if they want" (founder's words); it never interrupts or auto-navigates.

## Ripple (holistic — §6 item 5)
- New endpoint is additive (read-only, RLS-scoped); no schema/migration; no change to the fire-and-forget save path.
- `justSavedPitch` is client state, reset on a new pitch recording; no effect on the KPI/durability paths.
- The report-card detail page already handles the "still processing" state, so tapping right after a save (before
  the analysis finishes) shows an honest "processing" — not an error.

## A30 gate
Tests: the `/latest` redirect page (mock `redirect` + supabase → asserts it redirects to the pitch detail; and to
the list on no-pitch / read-error / unauth) + a DoorLog render test (the button is absent before a pitch, present
after a successful pitch save with the right href, absent after a dropped-audio save).

## Session-read manifest (A22 — every citation has a THIS-build read_at ≥ started_at 09:09:43)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-24T09:11:40+08:00",
    "why_it_governs": "Understanding before solving.",
    "how_this_build_will_embody_it": "Traced BOTH result flows (regular auto-navigates; Macro Door Log stalls) before writing code — the gap is Macro-only." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-32", "read_at": "2026-08-24T09:11:50+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Verified ThinkerThinker.md + TBC prompts in-tree; re-read each cited section fresh today." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-08-24T09:10:30+08:00",
    "why_it_governs": "The four-layer gate; this feature IS a layer-3 workflow-continuity fix.",
    "how_this_build_will_embody_it": "Built foundation-up: endpoint (L1) → detail nav (L2) → post-save IDLE placement (L3) → optional affordance (L4)." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-148", "read_at": "2026-08-24T09:11:10+08:00",
    "why_it_governs": "THINK+search before building.",
    "how_this_build_will_embody_it": "Searched both flows + the fire-and-forget save + the report-card data path before choosing the endpoint approach." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-08-24T09:11:20+08:00",
    "why_it_governs": "This is a coach affordance the rep may or may not want; §3.3 forbids the System taking over the flow — so it must OFFER the result (optional, dismissable-by-ignoring) rather than force it (auto-open / block the next door).",
    "how_this_build_will_embody_it": "The link is optional + non-blocking — it sits above the field flow, never auto-navigates, and never interrupts Record Pitch / No Answer." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-08-24T09:24:40+08:00",
    "why_it_governs": "Honesty is the moat — the affordance must not promise a 'result' that does not exist (a dropped-audio knock has no recording to review), and the jump must not dead-end when there is no pitch or a read fails.",
    "how_this_build_will_embody_it": "The link renders ONLY on a real pitch save (r.ok && !r.audioDropped, not a knock/dropped-audio); the redirect page falls back to the Pitch Performance list on no-pitch / read-error / unauth." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-445", "read_at": "2026-08-24T09:11:30+08:00",
    "why_it_governs": "Quick-decision checklist (item 5a workflow continuity; item 0 decision-picker).",
    "how_this_build_will_embody_it": "Pickered the one genuine decision (placement) with the founder; traced before/after continuity." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-24T09:12:00+08:00",
    "why_it_governs": "Methodology in the working tree — no cached labels.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A20", "source_file": "ThinkerThinker.md", "line_range": "480-483", "read_at": "2026-08-24T09:12:10+08:00",
    "why_it_governs": "Don't offload a decidable default to the founder.",
    "how_this_build_will_embody_it": "Pickered the genuine choice (placement); decided the implementation defaults (endpoint, detail-target) myself as defensible defaults." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-597", "read_at": "2026-08-24T09:12:20+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every cited § with a THIS-build read_at; the Session-Reads trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-08-24T09:12:30+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Route tests + a DoorLog render test that fail if the button/endpoint regress." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-08-24T09:12:40+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
