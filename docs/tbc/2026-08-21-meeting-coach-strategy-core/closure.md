# CLOSURE — Meeting Coach strategy core

## What shipped (to disk; not yet committed — proposal stage at the Phase-1 founder checkpoint)
The complete PURE CORE of the Meeting Coach: the `CoachingStrategy` seam, a sales adapter proving it fits the
shipped engine, a shared silent-safe parse, and both facilitation brains (meeting + huddle) as full strategy
classes with the LLM dependency-injected. 35 unit tests green; typecheck clean; zero production behavior change.

## The un-named reliance (§CLOSURE — what this quietly depends on)
- **The reuse map being right.** This build rests on `docs/SALESCOACH-REUSE-MAP.md`'s claim that `generateLiveCue`
  is the seam and the transport engine is context-agnostic. The sales adapter typechecking against the real
  `generateLiveCue` corroborates the seam; the attribution flag (N-party) is the one part the map moved from
  "reused" to "newly written" and the founder must confirm.
- **A future `CueLLM` that mirrors sales gating honestly.** The strategy classes honor a `suppressed` verdict but
  do NOT decide the gate — whoever supplies the `CueLLM` owns the control-month/model/`controlExempt` decision.
  If that binding silently drops the control gate (or wrongly applies it), the brains would faithfully relay the
  mistake. That decision is deliberately HELD, not defaulted.
- **N-party attribution existing eventually.** The meeting brain consumes speaker-labeled segments; its
  `imbalance` trigger is inert until Decision #1's attribution produces real per-speaker labels. It degrades to
  silent rather than guessing — but "balance coaching" is a no-op until attribution lands.

## Open (founder-gated — see `docs/MeetingCoach-BuildPlan.md` + project memory)
1. Decision #1 — capture/attribution.
2. The `CueLLM` binding gating/model.
3. Live wiring (step 2.3 / Phase 5) + `coaching_sessions` mode migration + Sales-Coach regression proof.
4. Real-hardware earpiece delivery check (reuse-map Flag 1).

## Next action when unblocked
On Decision #1 → build the attribution path + wire the engine to select a strategy by session mode. On a
`CueLLM` gating answer → add `liveMeetingCue` to claude.ts and inject it. Then a full `npm run check` before commit.

## Commit-prep NOT yet done (deliberate — proposal stage)
This dir has NO `started_at` front-matter or session-read manifest yet, so `tbc:*` currently treats the last
committed build (`add-agent-team-passwords`) as current and does NOT validate this dir — gate is green but this
dir is unchecked-by-the-suite (known; not a false green). Before COMMITTING the meeting-coach changes, complete
commit-prep: (1) add think.md front-matter with an honest `started_at`; (2) build the session-read manifest —
the §3.1.2 minimum set (§0, §0.1, §1.5.1, §1.5.2, §6, A19, A22, A30, A38) plus every §/A this dir cites, each
with an in-session `read_at` (A22: actually re-read A19/A22/A30/A38 first — they were NOT read this session);
(3) run the full `npm run check` (incl. `tbc`) and stage EXPLICIT paths (never `git add -A` — untracked founder IP).
