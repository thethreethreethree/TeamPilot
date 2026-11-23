# BUILD - Legal erasure reaches reps' day plans

Migration 0322 — applied to production. No env keys.

### Find
write-path: none (the search writes nothing; the identifier is not stored).
read-path: Settings → Protection → erasure → "Find calls" → POST /api/coach/remote/erasure { action: "find" } →
rss_erasure_matches (calls) + rss_erasure_day_plan_matches (plan id, rep, day) → the panel lists calls and "rep's day
plan" rows (no plan text).

### Erase
write-path: confirm → POST { action: "erase", sessionIds, dayPlanIds } → both re-searched, ids checked against the
results → erasure request (hash + hint) → audio → rss_erase_day_plans (identifier → "[removed]" in dump and plan;
completes the request when there are no calls) → rss_erase_sessions (when there are calls) → audit (plansErased).
read-path: the panel reports "removed them from N day plans"; the rep's Today page then shows the plan with "[removed]"
where the customer's details were; a new search for the same customer finds no plan.
