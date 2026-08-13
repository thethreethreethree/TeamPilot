# REMEDIATE — after-pitch heal convergence fix

## F1 — non-converging narrative-heal on one-sided recordings
Root cause: the F1 read-heal (`3b44945b`) triggered the auto-heal on `!existing.narrative.hasSignal`, reasoning
that a blank narrative under a true composite could only be a starved read because "scores ⟺ agent turns". But
the composite `hasSignal` has FOUR terms (`narrative || moments || scores || cueLoop`), and two of them fire
independently of agent turns: `moments` (MIN_SEGMENTS=1, ANY speaker) and `cueLoop` (live cues,
transcript-independent). On a one-sided / customer-only recording (0 agent turns): `salesReview` returns
EMPTY_REVIEW deterministically (no LLM), `salesScore` returns EMPTY, but `moments`/`cueLoop` can be present →
composite true → stored `{hasSignal:true, narrative:{hasSignal:false}}`. The heal fired `!narrative.hasSignal`
→ re-generate → narrative AGAIN deterministically blank → composite AGAIN true → never converges; every fresh
mount re-fires a full 4-engine generation (unbounded LLM spend) and the read stays blank.

Remediation: gate the narrative-heal clause on `existing.scores.length > 0`. `scores` is present IFF
`agentSegments ≥ MIN_AGENT_SEGMENTS` (salesScore.ts:181-182), which is EXACTLY the condition under which
`salesReview` would run instead of short-circuiting (salesReview.ts:67-70) — so scores-present ⟺ the read is
recoverable. Starved reads (agent turns) heal and converge under the 7000 budget; one-sided recordings (no
scores) are left correctly blank and un-regenerated (their moments/scores/cueLoop still render). The genuinely-
empty case (composite false) is unchanged and cheap (engines short-circuit without LLM). Regression-locked by
the one-sided-recording detection test. class: non-converging-auto-heal. severity: high. Fixed.

## Accepted (not fixed)
The tone-law "growth but no strengths" case and persistent F3 corpus starvation (both: agent turns → scores
present, narrative repeatedly blank) still re-heal per visit. Rare + semi-desirable (retry toward a valid
read) + bounded per-visit + tied to founder-gated corpus-trim. A durable once-per-session heal marker would
close it but adds a browser-API-throws surface for a rare case — deferred, flagged in the findings doc.
