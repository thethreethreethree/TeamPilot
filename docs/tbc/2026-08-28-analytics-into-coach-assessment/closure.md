# CLOSURE — Analytics merged into the Coach Assessment card (Task 2)

## What shipped
The founder-directed merge of Analytics into Coach Assessment, per-rep. Each rep's six per-skill /10 scores (the
distinct Analytics content) now render on their Coach Assessment card, fetched lazily on expand via a new cheap
`scoresOnly=1` mode (no per-rep LLM on the manager page). "Analytics" is now hidden from MANAGERS (a new `repOnly` nav
flag) — they see it merged on the card — while reps keep their own Analytics self-view, so nobody is stranded
(§1.5.1 layer 3).

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). The nav `repOnly` rule + the scoresOnly contract are unit-gated; typecheck +
591 files pass. The per-rep skill display on an expanded card is founder visual-verify.

## The un-named reliance
- **The SkillGrades render is not unit-tested** — a lazy client fetch jsdom can't meaningfully drive. The route
  contract (scoresOnly) and the nav rule are gated; that the six scores actually render on the card is founder
  visual-verify.
- **scoresOnly still reads recent after-pitch summaries + per-session transcripts for WPM** — no LLM, but N DB reads
  per expanded rep. Bounded (MAX_SESSIONS=10) and lazy (only on expand), so a collapsed team costs nothing.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "A manager who navigates DIRECTLY to /dashboard/sales-coach/analytics (URL, not the nav) still sees the old standalone Analytics manager view — the nav item is hidden, but the page isn't redirected.",
    "why_skipped": "The founder's ask was 'instead of GOING TO Analytics' — the nav no longer offers it to managers, which covers the normal flow. A hard redirect of managers on /analytics → /coach-assessment is a small optional follow-up (the page is not broken, just now redundant for managers).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T04:56:00+08:00",
    "outcome": "OPENED — add a manager→coach-assessment redirect on /analytics if you want the URL closed too."
  },
  {
    "id": "R2",
    "item": "The mobile bottom-tab 'Analytics' stays visible to everyone (managers included) — mobile tabs aren't role-filtered.",
    "why_skipped": "Mobile is the rep-centric surface (reps pitch on phones); the founder's ask was the desktop manager dashboard. A manager on mobile seeing their own Analytics is not broken.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-28T04:56:00+08:00",
    "outcome": "OPENED — filter the mobile tab too only if managers should lose it on phones."
  }
]
```
