# BUILD - Pipeline value trend and stage funnel

No migration. No env keys.

### See the 8-week trend and the funnel
write-path: none.
read-path: Pipeline → Forecast → GET prospects/changes?…&weeks=8 → openValueAt (open value at each week's end, replayed
from events) → TrendStrip ("Open pipeline over 8 weeks: $A → $B (±Δ)", one bar per week); StageFunnel ← stageFunnel(the
prospects on screen) → "Open deals by stage" with count and value.
