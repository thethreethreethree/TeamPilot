# BUILD — Trend tile shows the balance ratio

### Trend tile stats
- write-path: n/a (read-only tile).
- read-path: `MeetingTrendTile` now shows Actions owned / Stayed focused / Balanced (the three direction-driving
  ratios) instead of owned/focused/decisions; `pct(null)` → "—".

## Files
- `src/components/sales-coach/MeetingTrendTile.tsx` — `balancedRatio` on the Metrics type + the Stat swap.

## Reuse
Consumes the trend route's `balancedRatio` (already returned). Theme tokens. No sales/server change.
