# Sales Coach system audit — 2026-07-09

Founder request: complete audit of the Sales Coach system, find bugs, fix them, under
the framework. Method: 4 parallel read-only scouting agents (post-call engines,
live-coaching engines, ELO/prep/data-layer, all 44 routes) → **every finding
adversarially verified against the actual code before any fix** (a subagent can report
a plausible-but-wrong bug; §2 no-error-loops). Plus my own §1.7 foundation pass
(tables ↔ migrations, event-kind wiring, page concurrency, §A18 leaf surfaces — all
clean).

## FIXED (11 bugs — all verified against code, committed 8793056 + 1234907)

| # | Sev | Bug | Fix | Clause |
|---|---|---|---|---|
| 1 | HIGH | moments + pivot took `customerLine`/`repLine` VERBATIM from the LLM (only `atSeq` grounded) → a fabricated quote reached **managers** as a verbatim, timestamped statement | new `groundQuote()` (words-only transcript match, 6 tests); drops any quote whose words aren't in the transcript | §3.4, A18 |
| 2 | HIGH | rep-stress cue gated on `v.speaker` (loudness only), not the composed label → a "you sound nervous" cue fired at the rep for the **customer's** fillers when content/pitch overrode loudness; skewed the confidence read | use `provisional` (composed) | §3.4 |
| 3 | MED | score `citation` not grounded (A11 evidence could be a fabricated quote) | ground it (owner-visible; lower stakes than #1) | §3.4, A11 |
| 4 | MED | a 2nd breakdown moment kept `kind='breakdown'` (only the flag demoted) → two "turning points" | demote the kind too | off-spec |
| 5 | MED | an empty (noise) commit returned before clearing `utteranceStartRef` → next turn's pace measured across the gap → WPM too low → pace spikes silently missed | clear it on empty commit | §3.4 |
| 6 | MED | triple-tap (`previoustrack`) bypassed the hardware double-delivery dedup → toggled quiet on/off → did nothing | route through `fire()` | correctness |
| 7 | MED×4 | `coach/v5/analyze`, `coach/v5/followup`, `coach/analyze`, `sales-session/decision-dialogue` invoked the LLM with **NO auth check** — middleware doesn't cover `/api/*`, so an anon caller could drive the model on our bill | `getUser()` gate before the call on all four | security |
| 8 | MED | `getAgentEloGames` swallowed 3 query errors → a wrong founder-facing **rating** computed silently (a sessions-read error erases every outcome) | log each error | §3.4 |
| 9 | MED | `gatherWhyPairs` swallowed errors → the rep falsely told "keep going, need more sessions" on a transient failure | log | §3.4 |
| 10 | LOW | `sepAgree`/`sepTotal` accuracy tally not reset on `start()` → corrupt after a restart | reset them | correctness |
| 11 | LOW | `storeWhyPatterns` threw on a failed cache-write; `readStoredWhyPatterns` cast the payload unvalidated (`.patterns.map` crash on drift) | best-effort store + validate shape on read | §3.4 |

**Verification:** tsc 0, lint 0, next build 0, **487 tests** (+6 grounding). The
live-coaching hook fixes (#2, #5, #6, #10) are logic + build verified but **UNTESTED at
runtime** — they need a real live call to confirm behavior. Everything else is covered
by unit tests or is a mechanical gate addition.

## FLAGGED — not fixed (my call surfaced, per §3.3, for your decision)

These are LOW / by-design / need-a-product-decision. I did NOT unilaterally change them.

- **A1: talk_ratio/question_rate `score` is raw magnitude, not quality** (agent1 #5).
  An 80/20 over-talker shows `8/10` on the strip. The code comment says `display`/
  `computed` carry the honest meaning; the number feeds the ELO, so changing it
  **ripples into the rating** (§1.5) — a deliberate decision, not a silent fix. *Rec:*
  decide whether the strip should invert these two, and re-baseline ELO if so.
- **A2: manager can inject transcript into a rep's session** (agent4 #5). `segments`/
  `finalize`/`label-transcript`/`upload-recording` gate on `getSession` (owner OR
  same-company manager, 0084) then write via service-role. Migration 0082 called
  cross-agent transcript injection "a §A18 data-integrity hole." Managers (not peers)
  can append segments that feed the rep's Dissect/Review. *Needs your decision:* is
  manager-finalizes-a-rep's-call intended, or should these be owner-only like
  `cue-outcome`/`why` (which DO add `agentId !== auth.uid → 403`)?
- **A3: unbounded `.in()` truncates at Supabase's 1000-row default** (agent3 #2).
  `getCueRelianceSeries` + `salesElo` bulk-fetch rows; a very heavy user (>1000 cue
  rows) silently undercounts, bending the reliance trend down. *Rec:* a SQL count
  aggregate (bigger change) — directional-trend impact only.
- **A4: ELO replay sort key mixes `ended_at`/`started_at`/`dissect.at`** (agent3 #4) →
  a rare ordering inversion changes the path-dependent rating. LOW (ended≈started for
  short calls).
- **A5: `getRepWinningLines` doesn't collapse to the latest outcome per cue** (agent3
  #5) → a superseded `followed` line can resurface. LOW (rep_marked taps ~always
  followed).
- **A6: no fetch abort on live-coaching teardown** (agent2 #5) → a stale `/cue` or
  `/attribute` resolving after stop→start can write onto a new-session turn. LOW
  (needs stop→start inside the ~1-2s round-trip). *Rec:* an `AbortController` on
  `stop()` — a focused follow-up.
- **A7: 9 data-layer reads swallow query errors** (agent3 #3) — partly by design
  (graceful empty). The consequential ones (#8/#9 above) are now logged; the rest
  degrade to empty and are lower-stakes.

## Audited and confirmed CLEAN (reported honestly, no change)
ELO math (expected-score formula, K-update, clamps — correct); memory aggregation;
winning-lines dedup/sort; afterPitch index-space + timestamp math; prep engines
(failed-vs-empty handled); knowledgeBase cache; dissectBackfill bounds; every
`.single()`/`.maybeSingle()` (none on a multi-row select); the cue-gating engines
(cueDelivery/cueCoordination); liveConfidence + liveStress clamps; pitchSeparation;
speakerAttribution priority; salesReview/salesDissect/salesSummary/salesIntel parsers;
all correctly-gated routes (owner-private scores 403'd/stripped; no surviving false-ok
write; service-role reads company/actor-scoped).

## Session-read manifest
CLAUDE.md (context), AMD-006 (in full, this session), ThinkerThinker.md A11/A14/A18/
A23/A25 — read this 2026-07-09 session.
