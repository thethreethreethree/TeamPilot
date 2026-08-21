# BUILD — Fold balance into the trend

### Trend direction over three quality ratios
- write-path: n/a (pure aggregate). `MeetingMetrics` gains `balancedRatio`; `metricsFor` computes it from each
  payload's `balance.balanced`; the direction now counts up/down across owned-action, focused, AND balanced
  ratios (net-up = improving, net-down = declining, tie = flat). A missing ratio = no-change on that axis.
- read-path: `GET /trend` (unchanged) now returns a direction that reflects balance too, for the trend tile.

## Files
- `src/lib/coach/strategy/meeting/aggregateMeetingDissects.ts` — `balancedRatio` + the generalized direction.
- `.../__tests__/aggregateMeetingDissects.test.ts` — +1 test (balance alone drives 'improving'); the pre-balance
  tests still pass (missing ratio = no-change).

## Reuse
Pure change to the existing aggregate; the trend route + tile consume it unchanged. No sales/server change.
