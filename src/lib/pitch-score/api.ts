/**
 * Read clients for the Pitch Score API.
 *
 * READ-ONLY, DELIBERATELY. The phone writes nothing in this revision — disputes, overrides and
 * manager comments are web surfaces. There is no post here and there should not be one.
 *
 * NOTHING NEW ON THE SERVER. All three routes were built and deployed with the web boards, and
 * `coachGet` already resolves `ENV.API_BASE + path` with the caller's bearer token, so every one of
 * them is reachable from this app today. Until now the app called none of them: a grep for
 * `api/coach/sales-session/pitch-score` across `src/` returned nothing at all.
 *
 * A NOTE FOR WHOEVER RE-RUNS THAT GREP. The looser `pitch-score|pitchScore` returns one hit that is
 * NOT one — `after-pitch-card.tsx` imports `@/lib/after-pitch-scores`, an unrelated module sharing a
 * substring. Written down because the web build's own evidence record had to correct exactly that.
 *
 * EVERY ROUTE IS RLS-SCOPED TO THE CALLER, and each defaults to the caller's own id when no `repId`
 * is passed. That default is load-bearing rather than convenient: without it a rep's board would
 * read whatever their token can see and present the result as theirs, which for a manager would
 * quietly become the whole company's average with one person's name on it.
 */
import { coachGet } from '@/lib/coach-api';
import type { RubricResponse } from '@/lib/pitch-score/rubric';
import type {
  BestPitchesResponse,
  BreakdownResponse,
  LeaderboardResponse,
  MilestonesResponse,
  Period,
} from '@/lib/pitch-score/types';

const BASE = '/api/coach/sales-session/pitch-score';

/**
 * The period aggregate behind both boards.
 *
 * One request serves Progress and Breakdown. They are two views of the same period, and fetching
 * twice would let them disagree while a rep switched between them.
 */
export function fetchBreakdown(period: Period): Promise<BreakdownResponse> {
  return coachGet<BreakdownResponse>(`${BASE}/breakdown?period=${encodeURIComponent(period)}`);
}

/**
 * The competition card.
 *
 * What comes back for a rep is their own standing and ONE distance — how far behind the rep above.
 * Rank, board size and the cushion below are stripped at the route. Do not add a client-side
 * fallback that computes any of them from what is left.
 */
export function fetchLeaderboard(period: Period): Promise<LeaderboardResponse> {
  return coachGet<LeaderboardResponse>(`${BASE}/leaderboard?period=${encodeURIComponent(period)}`);
}

/**
 * Earned-at dates for the six Pitch Score milestones.
 *
 * NOT the gamification milestone strip. The phone already ships one of those, derived from the
 * points ledger, and two of the six names overlap — `spark` is "First session scored" against this
 * set's "First pitch", and the ledger's `century` counts sessions where this one counts scored
 * pitches. A rep records sessions that never qualify, so the two counts diverge permanently and
 * merging them would mean silently moving earned-at dates the Arena has already shown them.
 *
 * Whichever surface renders this must say what it counts, beside the one that says what the other
 * counts. That is a founder decision recorded as open, not something to settle here.
 */
export function fetchMilestones(): Promise<MilestonesResponse> {
  return coachGet<MilestonesResponse>(`${BASE}/milestones`);
}

/**
 * The rubric: the sheet's contents, the section maxima the Breakdown bars print, and the 0-130
 * scale the gauge runs on.
 *
 * ITS TYPES AND ITS ONE RULE LIVE IN `rubric.ts`, NOT HERE, and the split is deliberate rather than
 * tidy. This module imports `coach-api`, which imports `expo/fetch` — a native module the test
 * runner cannot load — so any rule sharing a file with it is untestable, and not subtly: the whole
 * file fails to import. `lowestSection` is the rule this build most needs a test on.
 *
 * NOT CACHED, and the header on the response does not change that: React Native implements no HTTP
 * response cache, so `Cache-Control` buys this app nothing. If the request count ever matters, hold
 * the body keyed by `version` — stronger than any duration, because the rubric is immutable per
 * version.
 */
export function fetchRubric(): Promise<RubricResponse> {
  return coachGet<RubricResponse>(`${BASE}/rubric`);
}

/**
 * The rep's highest counted pitches, for the board's best-pitch cards.
 *
 * QUALIFYING ONLY AND RANKED BY TOTAL, both decided by the server. A rep's best must mean the same
 * thing their total means, or the board celebrates a pitch that contributed nothing to the figure
 * printed beside it.
 *
 * Added 2026-09-22. The board shipped without these cards first, because `bestPitchScore` is one
 * number and three cards need a list.
 */
export function fetchBestPitches(period: Period): Promise<BestPitchesResponse> {
  return coachGet<BestPitchesResponse>(`${BASE}/best?period=${encodeURIComponent(period)}`);
}
