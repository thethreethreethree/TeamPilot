# BUILD - Forecast what-if

No migration. No env keys.

### Try moving a deal's date
write-path: none — nothing is sent or stored.
read-path: Pipeline → Forecast → "What if?" → date inputs per open deal (local state) → withMovedDates → forecastByMonth →
the table (months or quarters, past due) recomputed; "Back to the real dates" restores the saved dates.
