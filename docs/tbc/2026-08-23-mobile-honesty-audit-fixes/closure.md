# CLOSURE — mobile Sales Coach honesty + contrast fixes (F4 / F4b / F5)

## What shipped
Three clear, pre-existing mobile Sales Coach bugs surfaced by the proactive UX audit and confirmed against the code:
- **F4** — pitch-detail load failure now shows an honest, retryable error instead of the permanent "This pitch
  isn't available" (a 404-only mapping had collapsed 5xx/network into no-data).
- **F4b** — the mobile home "Pitches" pill shows "—" on a failed dashboard fetch instead of a false "0".
- **F5** — the only labeled mobile "Back to ELOSTATE" exit is now legible in light mode (was `text-white/50` on a
  near-white ground → theme-aware tokens).

All three match tracked classes + the founder's standing values (error-as-no-data sweep; invisible-text/contrast)
and mirror existing siblings/conventions, so blast radius is low. +2 detection tests; the full gate passed
(EXIT 0 — see check.md); no route/schema/data change.

## The un-named reliance
- F4/F4b rely on the sibling honesty pattern (explicit error state + Retry / "—") being the codebase convention —
  it is (PitchPerformance, TodaysMetrics, macroTotalsError). F5 relies on `text-muted`/`text-secondary` being
  theme-aware — they are (used throughout the `bg-base` mobile area, legible in both themes).
- `statsError` is set on the shared `load` but consumed only by the mobile pill, so the desktop tiles keep their
  own "honest empty 0" — a deliberate scope boundary, not an oversight.

## Residual (A36)

```json
[
  {
    "id": "mobile-back-nav-and-active-tab-gap-F1-F2",
    "item": "Audit F1+F2 (DESIGN, surfaced to founder via picker, NOT built here): several mobile pages give no in-page back affordance AND light no bottom-nav tab — non-macro Roleplay (/roleplay) + One Liners (/strategy) reached from home cards, and the macro rep's primary Door Log (/doors) reached from the Home card + Start Knocking CTA. TopBar renders no back on Sales Coach routes; the bottom-nav Home tab is exact-match only, so any non-tab child route lights nothing. Not a hard dead-end (the tab bar is always present) but a disorientation gap.",
    "why_skipped": "Multiple valid resolutions (add a shared back affordance to TopBar on SC mobile routes / make Door Log a tab / broaden the Home active-match) — a design decision. Surfaced via picker per §3.3 + the D1–D5 audit→picker precedent.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T10:45:00+08:00",
    "outcome": "Awaiting the founder's pick; a systemic fix (right altitude) is preferable to per-page band-aids."
  },
  {
    "id": "pitch-performance-label-collision-F3",
    "item": "Audit F3 (DESIGN, surfaced via picker): the label 'Pitch Performance' points to /analytics for a non-macro rep (home card) but to /doors/report-card for a macro rep (home card + the new nav tab); and /analytics carries two names on mobile ('Pitch Performance' card → a screen titled 'Analytics'). Minor same-destination/two-label cases: /roleplay = 'Roleplay Practice' vs 'Role Play'; /sessions = 'Live AI Coach & Sessions' vs 'Sessions'.",
    "why_skipped": "Label strategy is a design/product decision (which name wins, whether to unify) — founder's call. Mode-scoped, low impact today.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T10:45:00+08:00",
    "outcome": "Awaiting the founder's pick on the naming."
  },
  {
    "id": "desktop-tiles-error-as-no-data-not-changed",
    "item": "The desktop home tiles (DeckStat) still render 0 on a failed dashboard fetch (their documented 'honest empty' choice). F4b fixed only the mobile pill (the audit's scope).",
    "why_skipped": "Out of the mobile audit's scope + the desktop has a pre-existing documented rationale; changing it is a separate decision. Flagged for consistency if the founder wants the desktop tiles to also show '—' on failure.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T10:45:00+08:00",
    "outcome": "Flagged; unify mobile+desktop on failure if desired."
  }
]
```
