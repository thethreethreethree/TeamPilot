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

## ALSO FIXED (A3/A4/A5 — the flagged items that were clear bugs, not decisions; commit 78be8d2)

On reflection these three were correctness bugs with unambiguous fixes (not product
decisions), and the founder asked to FIX what was found — so they were applied:
- **A4 — ELO replay sort key** mixed `ended_at`/`started_at` across sessions → a
  path-dependent ordering inversion changed the rating. Now `started_at` uniformly.
- **A5 — `getRepWinningLines`** matched any `followed` row incl. superseded ones → a
  stale line resurfaced. Now collapses to each cue's latest outcome (rep_marked
  authoritative), keeps only currently-`followed`. +2 tests.
- **A3 — `getCueRelianceSeries`** silent 1000-row `.in()` truncation → undercounted
  reliance trend. Explicit 5000 bound + truncation log.
- **A6 — no fetch-abort on live teardown** (5279c41): a `/cue` or `/attribute` in
  flight during a stop→restart resolved into the new session. Fixed with a
  session-epoch guard (bumped on start/stop; captured per request; stale results
  dropped) — the same additive-safe pattern as the Dissect concurrency fix. UNTESTED
  at runtime but regression-safe by construction (can only drop a superseded result).

## STILL FLAGGED — genuinely your decision, or a focused follow-up (not unilaterally changed)

- **A1: talk_ratio/question_rate `score` is raw magnitude, not quality** (agent1 #5).
  An 80/20 over-talker shows `8/10`. The number feeds the ELO, so changing it
  **ripples into the rating** (§1.5) — a deliberate decision. *Needs your call.*
- **A2: manager can inject transcript into a rep's session** (agent4 #5) — mostly FIXED.
  Traced each route's callers and closed the two with no manager path, as safe security
  fixes (not decisions): **`segments`** (no caller at all — 7a9f8f8) and **`finalize`**
  (only the rep's own live-coaching hook calls it, on Stop — 2157768) are now owner-only
  (`session.agentId !== auth.user.id → 403`), closing the §A18 transcript-injection
  vector 0082 named. Both cannot affect the rep's own flow (they ARE the owner).
  **REMAINING (a genuine founder decision):** `upload-recording` / `label-transcript`,
  called by `SessionRecordingUpload`, which is rendered **UNGATED** on the session detail
  page (`[id]/page.tsx:822`, next to an equally-ungated `LiveCoachingPanel`). A manager
  who opens a rep's session (which the new flags feature links them to) CAN upload a
  recording that becomes the rep's transcript. *Your decision:* is manager-upload-for-a-rep
  intended (helping process the recording), or should the upload UI + those 2 routes be
  owner-only? If owner-only: (a) wrap the 2 components in an `isOwner` check, (b) add the
  `agentId → 403` gate to the 2 routes — applyable in minutes on your word.
- **A7: 9 data-layer reads swallow query errors** (agent3 #3) — partly by design
  (graceful empty). The consequential ones (ELO rating, why below-gate) are now logged;
  the rest degrade to empty and are lower-stakes.

## App-wide extension — the auth-gap class was systemic (commit 5d1651a)
The coach finding (#7 — 4 LLM routes with no auth check) prompted a sweep of EVERY
LLM-invoking route in the app. **10 more** had the same gap (LLM reachable by an
anonymous caller — gated only by rateLimit + `getCurrentCompanyId`, which returns null,
not an error, for anon; middleware doesn't cover `/api/*`): `ai/briefing`,
`chat/formulate|guide|summarize|similar`, `me/ask-jeff`, `tasks/spawn`,
`diagnosis/outside-view|ripple-trace`, `ai/decision-dialogue`. All now require
`getUser()` before the model call. **14 unauthenticated LLM routes closed total.**
Confirmed-safe (verified, not assumed, left unchanged): `ai/briefing/stream` (gates on
`!companyId`), `care/conversations/[id]/messages` (customer widget, token-gated),
`care/inbound/email` (webhook-secret). *Consider:* `llm/ping` (a deliberate provider
health-ping, rate-limited) — lower priority; decide if the connection test should
require an admin. **Regression check DONE:** traced every client caller of the 10 gated
routes — all live on the auth-gated dashboard (chat modals, dashboard pages, and the
`LearningModeFab`/Ask-Jeff chain which mounts ONLY in `dashboard/layout.tsx`, itself
server-side auth-gated). No pre-auth caller exists, so the gates are transparent to
real users and close only the anonymous-abuse vector.

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
