# CLOSURE — Training tab (slice 2)

## What shipped
The founder's Training tab. A manager opens Training and sees the team training brief (the shared panel from slice 1)
plus every rep's training focuses — the growth areas and strategy gaps distilled from that rep's Dissects. A rep opens
the same tab on their portal and sees ONLY their own focuses. The page role-branches on the server-gated team route
(403 → rep's own `my-training`), so neither role hits a dead end. The brief panel was extracted into one shared
component so the Coach Assessment view and the Training tab render the identical surface with no drift.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Typecheck clean; the manager team route stays gated; the rep self route is
self-data only (actor = caller).

## The un-named reliance
- **A rep's role is inferred from the team route's 403, not read directly on the page.** If the coach-assessment route
  ever returned 403 to a genuine manager (e.g. a transient auth hiccup), that manager would see the rep view for that
  load. Acceptable: the rep view shows the manager their OWN trainings (never another rep's), so the failure mode
  degrades to less-data, never wrong-tenant data. A reload re-resolves.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Rep 'trainings' are text-list focuses (growth areas + strategy gaps) from that rep's Dissects — not yet interactive materials or a practice loop.",
    "why_skipped": "The founder DEFERRED the practice engine explicitly ('build the Training tab next, defer practice engine'). This slice delivers the tab + per-rep + rep-access from data we already generate; materials + exercises + live AI practice feedback are the next slice, which has real design forks worth scoping first.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  },
  {
    "id": "R2",
    "item": "The Training page fetches on mount with no client cache; each open re-hits the coach-assessment (or my-training) route.",
    "why_skipped": "These routes are already used by the Coach Assessment view; the reads are bounded/cap-safe and infrequent (a tab open), so a cache would add complexity for negligible gain now. If open-frequency grows, a shared SWR-style cache is the additive fix.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-26T14:20:00+08:00",
    "outcome": "OPENED + bounded: correctness and honesty do not depend on caching; it is a latency optimization for later, surfaced not silently skipped."
  }
]
```
