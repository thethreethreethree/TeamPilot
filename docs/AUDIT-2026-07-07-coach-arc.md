# Audit — coach arc (2026-07-07), commits 3b18719→cff81fb

Founder-directed audit against CLAUDE.md + ThinkerThinker.md (AMD-006). Three
parallel auditors re-read the actual files; every finding below was
re-verified from source before landing here. Scope: pivot/timeline/scores/intel
engines + routes, the ELO, and the coach UI.

## Verified CLEAN (cross-confirmed by ≥2 auditors + my re-read)
ELO math (bounds [100,3000], guards, no div-by-zero, chess formula, computed-
proxy excluded from the mean); ELO access gate (peer-read 403, cross-company 404,
raw per-call scores never returned, manager history trimmed §A18); §A10 rep
self-view (Analytics badge, full history to self); §A18 owner-gate on
/summary-scores (agentId===caller→403, airtight); getLatestAfterPitchSummaryAdmin
reuse — no cross-owner leak + PRESERVES §A21; parse functions (pivot/moments/
graded/questionRate) grounded + crash-safe; §3.1 append-only; §3.4 control gate;
the 5→7 score grid (no leftover grid-cols-5); the auto-activate GET→POST (no
spinner/race/double-fetch); the finding-1 card fix (enrichment shows when summary
null); §A18 loading-flash hygiene. AMD-006 L2: the ELO delivers end-to-end on real
data (founder confirmed live: 1496 / 1505).

## Findings — FIXED this pass
- **§3.4 [MED] — parseIntel didn't ground competitors** → a hallucinated competitor
  would render as a manager-visible factual chip. FIXED: `groundCompetitors`
  drops any competitor name not present in the transcript (topics stay paraphrase-
  grounded). +3 tests.
- **§A14 [LOW-MED] — scoresCache never evicted on success** → after Re-summarize
  (or added transcript) the private scores froze/desynced for the SPA session.
  FIXED: `evictScoresCache` + a remount key on the Re-summarize path.

## Findings — RESOLVED / FOUNDER-GATED
- **§A11/§A18 [HIGH] — multi-agent ELO on Coach Assessment — RESOLVED (founder
  decision 2026-07-07, commit 6c84a4e).** The founder chose option (c): the ELO
  is a deliberate GAMIFIED feature (each rep vs the fixed 1500 standard, NOT a
  peer leaderboard), visible to admins/managers here + each rep's own on Analytics
  (§A10/§A18). The false "no scores" copy was amended to explain the gamification +
  visibility honestly (§3.4); the coaching NOTES stay comparison-free; the roster
  stays alphabetical, never rating-sorted (§A11). Contradiction closed.
- **AMD-006 L2 [MED] — finalize's concurrent LLM calls — RESOLVED (commit
  aade272).** Added a 25s per-call timeout so a hung provider call can't hold the
  route/response until the platform kills it; the happy path is unchanged.
- **§3.5 [MED] — outcome-less sessions rate on the System's own read alone**
  (no consequence anchor). This is the founder's DOCUMENTED relaxation (§A15-
  legit) so the back-catalogue rates; flagged for re-confirmation, on record.
- **AMD-006 L2 [MED] — finalize fires 5 concurrent LLM calls under keepalive.**
  Each is best-effort (.catch), but a single hung provider call holds the whole
  route until the platform kills it (no per-call timeout). Fix = after() for the
  enrichment, or a Promise.race timeout per engine — carries a UX/reliability
  tradeoff the founder owns.

## Findings — LOW polish (remaining, non-blocking)
- §A13/§A21 — after-pitch/page.tsx re-declares Moment/ScoreCategory locally
  (misses the new `sentiment`), so the sentiment arc renders on the summary
  surface but not on After-Pitch. Fix: import from summaryTypes + render it.
- §A21 — PivotAndScores score tiles lack the min-height box After-Pitch has →
  2-line labels misalign their number. Fix: port the min-height.
- brand — SessionCoachTools error text is `text-red-300` while the module is
  amber/ember ("no red"). Fix: amber.
- LOW — ELO replay uses mixed-source timestamps (dissect.at fallback) + a 500
  dissect-fetch cap; both matter only at scale. Comment/raise.

Gate + build green throughout; 387 tests.
