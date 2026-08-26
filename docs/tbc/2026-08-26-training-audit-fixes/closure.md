# CLOSURE — Training-system post-ship audit fixes

## What shipped
Four confirmed defects from the post-ship adversarial audit of the three training slices, each checked against the
code before fixing:
- **F1**: the "one focus per rep" section was structurally empty (rep names computed for the whitelist but never sent
  to the prompt). Now grounded — each rep's own top growth area feeds the prompt, so a real per-rep focus renders.
- **F2**: a transient 5xx no longer downgrades a manager to the rep view (only a 403 does).
- **F3**: a `degraded` read no longer hangs on "Loading…" behind the error banner.
- **Practice Finding-1**: a fresh "Practice X" launch starts clean instead of resuming a stale conversation and scoring
  it against a skill it never practiced; the focus is clamped to 600 chars.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). F1 guard test locks the prompt-carries-names contract; brief + roleplay tests
green; typecheck clean.

## The un-named reliance
- **The per-rep focus assumes each active rep has ≥1 growth point in the window.** A rep with a dissect but no growth
  signal is omitted from `repSignals` (no fabricated focus) — honest, but they get no line that period. Acceptable: the
  brief teaches the team pattern; per-rep is a bonus direction, not a guarantee.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "F1 grounds each rep's focus on their single top growth area; a rep with rich, varied signal still gets one line.",
    "why_skipped": "One grounded line per rep satisfies the founder's 'one focus each' spec and keeps the brief short (its whole point). Multi-signal per-rep depth belongs in the per-rep coaching view, not the team meeting brief.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-26T15:45:00+08:00",
    "outcome": "OPENED + bounded: the feature now produces a real, grounded per-rep line; richer per-rep depth is additive and lives on the coach-assessment surface, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "F2/F3/Finding-1 fixes are confirmed by reading, not by a new client render test.",
    "why_skipped": "They are status-code branches + an early return in client effects; the project has no render-test harness for these pages and the logic is simple + read-checked. A render test is a later hardening.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
