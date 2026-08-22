# CLOSURE — Pitch worker: terminalise a crash/timeout loop (audit H2)

## What shipped
The Macro Mode pitch worker no longer loops "processing…" forever on a crash-class failure. `attempts` now
advances at **lease** time (inside `claimPitchForProcessing`, the same atomic conditional update that already
prevents double-spend), so a serverless timeout / OOM / hard-kill that skips the worker's `catch` still consumes
an attempt. Once the lease pushes `attempts` past `MAX_PITCH_ATTEMPTS`, `processPitch` terminalises the pitch
honestly (`failed` + a truthful message + Sentry) instead of re-claiming and re-crashing. The ordinary throw path
is byte-unchanged (5 real tries; catch fails at `>= MAX` and no longer re-increments). No schema change, no
migration — deployable immediately. Full `npm run check` exit 0. +2 tests.

This closes audit finding **H2** (`docs/RELIABILITY-AUDIT-2026-08-22.md`). H1 was already shipped
(`d9160efe`); H3 (worker derived-table writes swallow errors) and H4/M4 (meeting Dissect self-heal) remain in
their own bundles.

## The un-named reliance
- **Lease atomicity.** Correctness of the increment relies on the same Postgres row-lock the double-spend guard
  already depends on: a win means the row was still due, so the candidate-read `attempts` is the live value.
- **Cron liveness.** Terminalisation of a crashed pitch happens on the NEXT claim, so it relies on the
  per-minute pitch cron continuing to run (registered in `vercel.json`; the audit confirmed it "already solid").
  A poison pitch terminalises after ~6 lease cycles (~30 min) — bounded, not instant, but finite (was infinite).

## Residual (A36)

```json
[
  {
    "id": "h2-poison-terminalises-in-~30min-not-instant",
    "item": "A crash-looping pitch now goes terminal after ~6 lease cycles (~30 min), not on the first crash.",
    "why_skipped": "Detecting a crash mid-run is impossible without an in-process signal a crash by definition skips; counting leases is the honest bound. The window is finite (was infinite) and the UI already shows an honest 'processing' state during it.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T14:35:00+08:00",
    "outcome": "Bounded escape via the existing cron+lease loop; acceptable."
  },
  {
    "id": "h3-h4-m4-remaining-audit-findings",
    "item": "H3 (worker derived-table writes swallow their Supabase error → complete-with-no-analysis), H4 + M4 (meeting Dissect caches a transient failure permanently; unconditional 'saving now' copy) are still open.",
    "why_skipped": "Each is a separate root shape shipping as its own verified bundle; H2 was the founder-picked one and the pure 'loops forever' class.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T14:35:00+08:00",
    "outcome": "Tracked in docs/RELIABILITY-AUDIT-2026-08-22.md; next bundles."
  }
]
```
