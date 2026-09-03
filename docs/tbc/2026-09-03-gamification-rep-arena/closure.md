# CLOSURE — Rep Arena

## What shipped
The rep's own gamification dashboard ("My Progress" → the Arena), built from the founder's arena-v2 reference and
reskinned to ELOSTATE (ember-on-ink, the bulb). Six elements, each rewired from the gym reference to a Sales Coach
gamification concept: a radial gauge (avg points + band), an odometer (total points), a stat pair (strong sessions +
deals), a best-pitches board (links to each after-pitch), milestone badges (derived on/off), and a 7-session bar
chart. Fed by the EXISTING /my-points + /leaderboard endpoints — no new route or migration. A client-safe bands.ts
single source lets the UI share the band definitions without pulling the server-only rubric; a pure deriveArena
carries the (tested) logic.

## Verification (AMD-012 / A38)
typecheck + lint + theme:audit (0 leaks) + 6 deriveArena tests + full suite (3994) + nav (16); and the specified
design RENDERED to PNG and READ in BOTH dark and light themes. All in check.md.

## The un-named reliance
- Relies on /leaderboard returning the caller's row (best_points, deals) + meRank; if it fails to load, deriveArena
  falls back to the rep's own history for best and deals→0 (tested), so the screen still renders honestly.
- Relies on --brand-text flipping to a WCAG-AA ember on cream (globals.css, founder-tuned) so the hardcoded accent
  isn't needed and the light theme stays legible.
- Relies on my-points now summing the FULL history (the sibling fix this session) so the odometer + gauge match the
  leaderboard for the same rep.

## Residual (A36 — explicit)
```json
[
  {
    "id": "GAM-R12",
    "item": "The compact MyProgress strip still renders on the Scoreboard alongside the new full Arena page — two personal-progress surfaces.",
    "why_skipped": "Removing/redirecting the strip is a UX call the founder may want either way; the Arena works standalone and the strip is harmless.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T13:56:00+08:00",
    "outcome": "OPEN — consider replacing the Scoreboard strip with a link to the Arena, or leave both."
  },
  {
    "id": "GAM-R13",
    "item": "Milestones are derived from current stats (sessions/strong/deals thresholds), so a badge lights the moment the stat crosses — there's no 'earned on <date>' provenance or unlock animation.",
    "why_skipped": "A milestones store/event is a larger feature; the derived version is honest and needs no schema.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T13:56:00+08:00",
    "outcome": "OPEN — add an earned-at store + unlock moment if milestones become a first-class feature."
  }
]
```
