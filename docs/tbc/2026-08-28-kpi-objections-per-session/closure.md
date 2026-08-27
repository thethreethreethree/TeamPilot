# CLOSURE — Objections per session (Task 3, part 2)

## What shipped
The KPI Analytics page's "Objections per session" tile — dead ("building" forever) — is now a real metric, plus a
sibling "Objections resolved" rate. The after-pitch LLM pass (same call, no new cost) now emits a whole-call
`objections: {raised, resolved}` tally; it's stored on the summary payload and averaged/rated by the /me KPI route.

## The mid-build correction (the honest part)
My first approach counted `kind="objection"` hero-moments. Verifying against LIVE data refuted it (the moments are
a 3-5 highlight reel → an undercount, and "resolved" wasn't derivable). I corrected the founder (§3.3), surfaced
the fork, and the founder chose the real tally. The refuted approach never shipped.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Parse + compute + honesty gates are unit-gated (+9 cases). The LLM's
counting judgement over a real transcript is founder visual-verify.

## The un-named reliance
- **The model's tally quality is not unit-tested** — jsdom has no live LLM. The prompt asks for distinct customer
  objections + how many the rep moved the customer past, with resolved ≤ raised; that it counts SENSIBLY is
  founder visual-verify on a real session.
- **The metric gates until history is re-analyzed** — existing summaries have no tally, so a rep sees "building"
  until ≥ MIN_SESSIONS tallied sessions accrue. This is correct §3.4 behavior (no instant results), not a bug.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "History backfill — a bulk re-generation of existing after_pitch_summaries would populate the tally for past sessions so the metric lights up sooner. Not run: it re-invokes the LLM per session (real cost) and is a founder cost decision; the metric fills naturally as pages regenerate.",
    "why_skipped": "Gating until tallied sessions accrue is the correct §3.4 behavior; forcing instant numbers via an expensive backfill is the founder's call, offered separately.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T07:05:00+08:00",
    "outcome": "OPEN — offer the founder a costed backfill of history if they want the metric populated now."
  },
  {
    "id": "R2",
    "item": "The other 3 unbuilt KPI tiles (Sales cycle, Follow-up rate, Recommendation uptake) remain 'building'. Sales cycle + Follow-up need prospect-identity capture; Recommendation uptake is buildable next.",
    "why_skipped": "The founder picked Objections per session for this build; the rest are a separate pick.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-28T07:05:00+08:00",
    "outcome": "OPEN — next KPI-feature pick, or the honesty relabel of the still-unbuilt tiles."
  }
]
```
