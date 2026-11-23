# BUILD - Deal risk and forecast

No migration. No env keys or dashboard settings.

### See why a deal may slip
write-path: none — computed from the pipeline already read.
read-path: Pipeline → List → each open prospect row shows "At risk: …" (two or more reasons) or "Watch: …" (one), or
"Missing: No deal amount"; dealRisk() in src/lib/coach/remote/dealRisk.ts.

### Forecast and what-if
write-path: none.
read-path: Pipeline → Forecast (follows "Whose pipeline") → forecast(): open pipeline (and deals with no amount),
expected from open deals (open × this pipeline's win rate, "Not yet" below 5 closed deals), "If the at-risk deals are
lost"; the at-risk deals largest first, each opening its prospect (goTo).
