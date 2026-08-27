# BUILD — Recommendation uptake (deterministic, direction-aware)

### The direction-aware uptake computation
- write-path: `compute.ts` — `FOCUS_IMPROVEMENT_DIR` encodes each flaggable dimension's improving direction
  (talk_ratio→lower, question_rate→higher); `recommendationInputFromPayload` reads the score map + the first
  flagged dimension with a KNOWN direction as `focusKey`; `recommendationUptake` dedups, orders by start time, and
  counts a taken-up pair iff N+1 moved the focus dim the improving way.
- read-path: `me/route.ts` sets `metrics.recommendationUptake`; `kpi/page.tsx` renders the Layer-4 tile (pct).

### Chronological ordering + append-only dedup (structural guards)
- write-path: `recommendationUptake` builds a Map by sessionId (collapses append-only multi-view rows → one per
  session), then sorts by `startedAt`; `me/route.ts` supplies each session's real `started_at` from `data`.
- read-path: a re-viewed session never pairs with itself (no false 0-delta), and pairs are always the true
  chronological neighbours regardless of the payload fetch order (which is by uuid `id`, not time).

### Honesty gate (§3.4)
- write-path: gate at ≥ MIN_SESSIONS EVALUABLE pairs (focus flagged AND re-scored next session); a non-rescored
  or unknown-direction pair is EXCLUDED, never guessed.
- read-path: a rep without enough evaluable pairs sees "building", never a fabricated uptake %.

## Files
- `src/lib/coach/kpi/compute.ts` — FOCUS_IMPROVEMENT_DIR + recommendationInputFromPayload + recommendationUptake
- `src/app/api/coach/kpi/me/route.ts` — build recommendationRows (same payloads + a session→started_at map), set the metric
- `src/app/dashboard/sales-coach/kpi/page.tsx` — wire the "Recommendation uptake" tile
- `src/lib/coach/kpi/__tests__/compute.test.ts` — +7 cases (both directions, ordering, dedup, not-evaluable, gate, parser)

## Ripple (§6 item 5)
- Pure additions to compute + one metric key in the route + one tile apiKey; no schema, no new read, no LLM.
- `FOCUS_IMPROVEMENT_DIR` DUPLICATES a fact owned by salesScore.ts (which dimensions flag + their direction). A
  comment ties them; if a THIRD flaggable dimension is added there without a direction here, it is simply skipped
  (excluded, honest) — never miscounted. (Drift is safe-by-construction, not silent.)
- The team roster is untouched (this is a /me self-view Layer-4 metric).

## Honest limit (verify)
- The metric only evaluates the two computed flaggable dimensions (talk_ratio, question_rate) — the only ones the
  score engine flags today. A focus that came from a free-text growth area (no flagged score) starts no pair; that
  session still contributes its scores for a NEXT-session comparison. Live-verified: Moses 13/22, Johns 4/5.
