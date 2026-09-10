# 01 — Process breakdown (Coach Assessment)

**What it is.** Under the six skill scores in the **Coach Assessment** card, a "Process breakdown" section shows
the rep's performance across the **four sales phases** — intro, discovery, consultation, close — each with a
0–10 average and a one-line improvement tip. It's the 9/2 partner-meeting request #1.

**App work: render an existing endpoint.** The scoring is server-side already; the app reads it.

## Web source of truth
- Engine: `src/lib/coach/v5/processBreakdown.ts` — `generateProcessBreakdown` (a 5th parallel engine in the
  after-pitch pipeline, `src/lib/coach/v5/afterPitch.ts`), `aggregateProcessBreakdown`.
- Types: `src/lib/coach/v5/summaryTypes.ts` — `PROCESS_PHASES = ["intro","discovery","consultation","close"]`,
  `ProcessPhase = { key, label, score: number|null, tip: string, citation: string|null }`.
- Stored per session in `after_pitch_summaries.payload.processBreakdown` (no schema change).
- Endpoint: `GET /api/coach/sales-session/skills?agentId=<rep>&scoresOnly=1` returns `{ skills, processBreakdown,
  sampleSessions }`. `processBreakdown` is the **aggregate** across the rep's recent sessions.

## Data contract (what the endpoint returns)
```
processBreakdown: [
  { key: "intro"|"discovery"|"consultation"|"close",
    label: string,          // "Intro", "Discovery", ...
    avg: number | null,     // 0–10 average over graded sessions; null = not enough data
    samples: number,        // how many sessions contributed
    tip: string }           // improvement tip, taken from the WEAKEST graded session
]
```
- `avg` is null when no session graded that phase → render "building" / "not enough yet", never `0`.
- Canonical order is always intro → discovery → consultation → close.

## UI to build (native)
- A section titled **"Process breakdown"** (amber/label styling) directly under the skill scores in the Coach
  Assessment screen. Manager view: per-agent (the manager picks an agent → `agentId`); rep view: their own.
- One row per phase: the label, the `avg` as `N/10` (tabular), a thin bar or dot at avg/10, and the `tip` beneath.
- Null `avg` → a muted "Not enough sessions yet" row (no bar).

## States
- Loading; loaded; null-avg phases ("building"); endpoint error → `—` and a retry, never a fabricated 0.

## Notes
- `scoresOnly=1` is the cheap path (deterministic aggregate, no LLM) — use it for the manager list where many
  agents render at once. The full per-skill AI one-liners are a separate, heavier call on the rep's own view.
