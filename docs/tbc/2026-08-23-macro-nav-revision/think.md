---
started_at: 2026-08-23T10:15:00+08:00
---

# THINK — Macro Mode bottom-nav revision (founder annotated mockup 2026-08-23)

The founder sent an annotated screenshot of the Sales Coach **Macro Mode** mobile home with four edits:
1. Move **Today's Metrics** into the bottom nav bar.
2. Move **Pitch Performance** into the bottom nav bar.
3. **Remove AI Agent** from the nav, keep **Role Play**.
4. (implied by the arrows) the two data views land on the Role Play / Team Chat slots.

## Understanding first (§0) — what the code actually is

The screenshot is `MACRO_MOBILE_TABS` in `SalesCoachShell.tsx` (`[Home, Role Play, Team Chat, AI Agent]` — swapped
in for `MOBILE_TABS` while Macro Mode is on). The macro home grid (`dashboard/sales-coach/page.tsx`, `macroOn`
branch) showed three cards: Door Log, Today's Metrics, Pitch Performance. Confirmed the real routes before wiring a
tab to each: Today's Metrics → `/dashboard/sales-coach/doors/todays-metrics`, Pitch Performance →
`/dashboard/sales-coach/doors/report-card`, Role Play → `/dashboard/sales-coach/roleplay` (all pre-existing).

## The genuine decision → picker, not a guess (§3.3 / AMD-013)

The arrows resolved most of the intent, but left ONE consequential ambiguity: Today's Metrics + Pitch Performance
land on the Role Play/Team Chat slots while "replace AI Agent with Role Play" keeps Role Play — so **Team Chat's
fate** (dropped → 4 tabs, or kept → 5 tabs) and **whether the moved cards stay on the home grid** were undecided.
Guessing here is the "why did you ignore my instruction" rework risk. Per §3.3 (guide, don't overtake) + AMD-013,
I surfaced an `AskUserQuestion` picker with ASCII previews + a recommendation rather than assume.

**Founder chose:** (1) **Drop Team Chat — 4 tabs**: `[Home] [Pitch Performance] [Today's Metrics] [Role Play]`;
(2) **Remove the cards (true move)** — the macro home grid keeps Door Log only.

## Four-layer evaluation (§1.5.1)

- **Layer 1 (structure):** reuses the existing `NavItem`/`MACRO_MOBILE_TABS` array + `MobileCard` — no new
  abstraction, sound.
- **Layer 2 (effectivity + AMD-012):** the founder NAMED the nav contents, so per §1.5.4 the nav layout IS the
  intended result (layer 2, not waivable layer-4 polish). Each new tab points at a real, working route (verified).
- **Layer 3 (composition / continuity):** removing Team Chat + AI Agent from the macro nav removes their only
  mobile-macro entry points. Door Log stays reachable (home card); Metrics/Pitch are now reachable (nav). Team Chat
  stays reachable on desktop + the non-macro mobile nav, but NOT for a mobile macro rep — a real consequence, which
  I DISCLOSED in the picker ("still reachable from the desktop sidebar") and the founder chose knowingly. AI Agent
  (Live Sessions) removal aligns with the door-to-door focus. **Flagged** in the residual, not blocked (founder's
  informed call).
- **Layer 4 (UI):** "Pitch Performance" / "Today's Metrics" are longer than the old tab labels and wrap to 2 lines
  in a 4-tab bar (the container is `items-stretch` + wrapping, so it renders, just taller-text on those two). A
  visual go-live check is the layer-4 follow-up; the labels are kept verbatim to the founder's mockup naming.

## Encode the lesson (A30)

This macro nav has flip-flopped before (built 2026-08-19; the file's history notes an earlier 07-31→08-01
grouping reversal on the desktop nav). So the new set + ORDER are locked in `salesCoachShellNav.test.ts` (and the
card removal in `macroCardVisibility.render.test.tsx`) so a future edit can't silently regress it.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T10:22:40+08:00",
    "why_it_governs": "Understand the surface before changing it — read the real MACRO_MOBILE_TABS + macro home branch + routes first.",
    "how_this_build_will_embody_it": "Traced the exact array, home-grid branch, and each destination route before wiring; no guess." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T10:22:40+08:00",
    "why_it_governs": "Methodology in the working tree, read THIS build — not cached labels from the earlier D1/D2 build an hour ago.",
    "how_this_build_will_embody_it": "Re-opened every cited section fresh for this distinct build (timestamps ≥ started_at 10:15)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T10:23:10+08:00",
    "why_it_governs": "Four-layer sieve for a UI change — structure, effectivity, composition (reachability), surface.",
    "how_this_build_will_embody_it": "Evaluated all four; caught the layer-3 Team-Chat mobile-reachability consequence and flagged it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-08-23T10:23:10+08:00",
    "why_it_governs": "Proactive audit of the adjacent surface, not just the literal edit.",
    "how_this_build_will_embody_it": "Checked reachability of the removed items + orphaned imports + adjacent tests, and flagged the mobile-Team-Chat gap." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-231", "read_at": "2026-08-23T10:23:40+08:00",
    "why_it_governs": "A user-specified experience is layer-2 (the intended result), not deferrable layer-4 polish.",
    "how_this_build_will_embody_it": "The founder-specified nav contents are treated as the deliverable (built + test-locked), not filed as optional polish." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-08-23T10:22:10+08:00",
    "why_it_governs": "Guide, don't overtake — at a genuine decision point, ask before asserting.",
    "how_this_build_will_embody_it": "The ambiguous Team-Chat/card-removal choice went to an AskUserQuestion picker with a recommendation, not a guess." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T10:24:00+08:00",
    "why_it_governs": "The quick-decision checklist — incl. AMD-013 (a decision MUST be a picker) + AMD-012 (specified experience = layer-2).",
    "how_this_build_will_embody_it": "Ran it: picker for the decision, traced ripple (imports/tests/reachability), explained the WHY." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T10:24:30+08:00",
    "why_it_governs": "Methodology in the working tree — cited labels without content is the CAT-001 failure.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this build; no citation from cached memory." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T10:24:45+08:00",
    "why_it_governs": "Citations without a session-read are undetected A19 violations.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at (≥ started_at 10:15); the Session-Reads trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T10:25:00+08:00",
    "why_it_governs": "A lesson in prose returns — encode it in a gate that fails without cooperation.",
    "how_this_build_will_embody_it": "Locked the new macro nav set + ORDER + card removal in tests, because this nav has flip-flopped before." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T10:25:20+08:00",
    "why_it_governs": "'Verified' names the exact command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code — not a hand-picked subset." }
]
```
