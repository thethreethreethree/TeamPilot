# CLOSURE — latest-summary-per-session dedup

## What shipped
A shared `latestSummaryPerSession` helper, wired into both KPI readers (/me + /team), collapses the append-only
after_pitch_summaries to the latest row per session before any payload metric reads it. This fixes a latent
double-count (re-generated sessions — every viewed pitch — were counted multiple times in Layer-3 sample sizes) and
is the required prerequisite for the objection backfill (a re-generated tallied summary is now correctly read as
the current one).

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). The dedup is unit-gated (+2 cases) and typechecked across both routes.

## The un-named reliance
- **The live per-session effect is founder visual-verify** — the pure helper + both wirings are gated, but a
  re-generated session counting once on the live page is not exercised by a jsdom harness.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The objection backfill ITSELF is not yet built/run. With the dedup safe, re-generating after-pitch for existing sessions (appending a tallied summary the reads now pick as latest) would populate Objections now. It needs a batched LLM re-generation (real cost) — mechanism + execution to be confirmed with the founder.",
    "why_skipped": "The dedup prerequisite had to land first (it fixes a real double-count); the re-gen is a separate paid operation the founder should trigger consciously.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-28T12:00:00+08:00",
    "outcome": "OPEN — confirm the backfill mechanism + cost with the founder, then build + run."
  }
]
```
