import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScoreCategory } from "./summaryTypes";
import type { SalesOutcome } from "@/lib/data/salesCoach";

/**
 * Agent Sales Effectivity Rating — an ELO the rep plays against OUR MEASUREMENT
 * STANDARD, not against other reps (founder 2026-07-07). Each qualifying session
 * is one "game": the rep's composite performance is scored 0..1 and run through
 * the chess-ELO update against a FIXED opponent (the "competent call" standard).
 * Beat the standard consistently → rating climbs.
 *
 * Constitutional shape:
 *  - §A11 (mirror, not verdict) + §A18: this is growth-vs-a-standard, never a
 *    leaderboard. The rep sees their OWN rating (§A10 — no shadow read), framed
 *    as a curve; nobody sees another rep's number ranked against theirs.
 *  - §3.5 (consequence, not agreement): the OUTCOME (did it actually sell /
 *    advance) is half the game score; coached process quality is the other half.
 *    Balanced (founder decision) — a strong call to a hopeless prospect still
 *    gains, a sale confirms it.
 *  - §4 (evolution gated by outcome): this is a NEW measurement method. It ships
 *    PROVISIONAL and must be validated against an alternative before it is
 *    trusted — the surface marks it provisional until a game threshold is met.
 *
 * Pure + dependency-free so the math is regression-pinned.
 */

export const STARTING_RATING = 1500;
export const OPPONENT_RATING = 1500; // the fixed "competent call" standard
export const K_FACTOR = 24;
/** Chess-scale bounds (founder 2026-07-07: 3000 = chess max rating). Against a
 *  1500 standard the practical band is ~1000-1900; 3000 is the theoretical
 *  ceiling as in chess, 100 the floor — the rating never goes negative/unbounded. */
export const MAX_RATING = 3000;
export const MIN_RATING = 100;
/** Below this many games the rating is PROVISIONAL (§4 — not yet trustworthy). */
export const PROVISIONAL_GAMES = 5;

export type EloFactors = {
  /** After-pitch graded + computed categories for the session (the rating). */
  scores: ScoreCategory[];
  /** Quality signal from the growth review / dissect: counts of each. */
  strengths: number;
  growthAreas: number;
  /** The recorded call outcome (the consequence). */
  outcome: SalesOutcome | null;
};

export type EloGame = {
  sessionId: string;
  /** ISO time the session ended — games are replayed in this order. */
  at: string;
  factors: EloFactors;
};

export type EloHistoryEntry = {
  sessionId: string;
  at: string;
  gameScore: number; // 0..1
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
};

export type AgentElo = {
  rating: number;
  gamesPlayed: number;
  provisional: boolean;
  history: EloHistoryEntry[];
};

/**
 * Outcome → a 0..1 value (the consequence half). `no_contact` is NOT a game — no
 * conversation happened — so it returns null and the session is excluded (§3.4 —
 * don't score what didn't occur). `undecided` sits at the neutral midpoint.
 */
export function outcomeValue(outcome: SalesOutcome | null): number | null {
  switch (outcome) {
    case "sold":
      return 1;
    case "follow_up":
      return 0.7;
    case "undecided":
      return 0.5;
    case "no_sale":
      return 0.35;
    case "no_contact":
      return null; // not a game
    default:
      return null; // no outcome recorded yet → not a completed game
  }
}

/** Mean of the GRADED quality categories, normalized to 0..1. Audit finding A
 *  (§3.5): only the graded categories (opener/objection/tone/close/next_step)
 *  carry a genuine 0-10 QUALITY score. The COMPUTED categories (talk_ratio,
 *  question_rate) put a share-proxy in `.score` for uniform strip rendering — a
 *  balanced 50/50 talk ratio has `.score` 5, which is GOOD, not mediocre — so
 *  averaging them would distort performance downward. Quality = graded only.
 *  Returns null when there is no graded score to judge (§3.4 — don't rate thin). */
function meanScore01(scores: ScoreCategory[]): number | null {
  const graded = scores.filter((c) => !c.computed);
  if (graded.length === 0) return null;
  const sum = graded.reduce((a, c) => a + Math.max(0, Math.min(10, c.score)), 0);
  return sum / graded.length / 10;
}

/** Quality from the review: share of observations that were strengths vs growth
 *  areas. Neutral 0.5 when the review had neither. */
function quality01(strengths: number, growthAreas: number): number {
  const total = strengths + growthAreas;
  if (total <= 0) return 0.5;
  return strengths / total;
}

/**
 * The 0..1 game score for one session. BALANCED = half consequence (outcome) +
 * half performance (the conversation quality). Performance is composed from
 * whatever valid signal the session has: the after-pitch graded SCORES (rating)
 * and/or the DISSECT's strengths-vs-growth (quality) — so a dissected session
 * counts even without an after-pitch (founder 2026-07-07).
 *
 * OUTCOME handling (founder 2026-07-07): when an outcome was recorded it is half
 * the game (§3.5 consequence anchor); when it was NOT recorded the session still
 * counts on process/quality ALONE — a deliberate, founder-chosen relaxation so
 * the back-catalogue of valid calls generates a rating. `no_contact` is never a
 * game (no conversation happened, §3.4). Returns null when the session has no
 * process signal at all (nothing to rate, §3.2/§3.4).
 */
export function gameScoreFromFactors(f: EloFactors): number | null {
  if (f.outcome === "no_contact") return null; // no conversation → not a game

  // NB: these are NORMALIZED [0,1] game-score components — NOT ELO ratings (the ELO scale lives in
  // updateElo's `rating`/`opponent`). Named `...Score01` so `0.5*a + 0.5*b` is never misread as blending
  // ELO ratings (which would be a real bug). meanScore01 / quality01 both return [0,1] or null.
  const processScore01 = meanScore01(f.scores); // after-pitch graded delivery scores, or null
  const qualityScore01 =
    f.strengths + f.growthAreas > 0
      ? quality01(f.strengths, f.growthAreas) // dissect strengths vs growth
      : null;

  // Performance = the conversation-quality signal. Prefer both; else whichever
  // exists. No signal at all → not a gradeable game.
  let performance: number | null;
  if (processScore01 !== null && qualityScore01 !== null)
    performance = 0.5 * processScore01 + 0.5 * qualityScore01;
  else performance = processScore01 ?? qualityScore01;
  if (performance === null) return null;

  const outcome = outcomeValue(f.outcome); // number if recorded, else null
  const game =
    outcome !== null ? 0.5 * outcome + 0.5 * performance : performance;
  return Math.max(0, Math.min(1, game));
}

/** Chess-ELO expected score for a player vs an opponent rating. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

/** One ELO update: newRating = rating + K * (actual - expected), clamped to the
 *  chess-scale bounds [MIN_RATING, MAX_RATING] (audit finding B / founder 3000). */
export function updateElo(
  rating: number,
  gameScore: number,
  opponent = OPPONENT_RATING,
  k = K_FACTOR
): number {
  const expected = expectedScore(rating, opponent);
  const next = Math.round(rating + k * (gameScore - expected));
  return Math.max(MIN_RATING, Math.min(MAX_RATING, next));
}

/**
 * Replay an agent's qualifying games chronologically from STARTING_RATING.
 * Non-games (null game score) are skipped, not counted. The rating is PROVISIONAL
 * until PROVISIONAL_GAMES completed games (§4).
 */
export function computeAgentElo(games: EloGame[]): AgentElo {
  // Total order, not just by `at`: the replay is path-dependent (updateElo folds
  // games in sequence), so the sort must be DETERMINISTIC. `at` alone leaves ties
  // (two sessions sharing started_at) to fall through to input order — which comes
  // from DB reads ordered `created_at desc` with no stable secondary key, i.e.
  // non-deterministic across runs → a non-reproducible rating. sessionId is unique
  // per game (one game per session), so it's a stable total-order tie-break. This
  // completes the path-dependence fix begun by the uniform-`at` key choice below.
  const ordered = [...games].sort(
    (a, b) => a.at.localeCompare(b.at) || a.sessionId.localeCompare(b.sessionId)
  );
  let rating = STARTING_RATING;
  const history: EloHistoryEntry[] = [];
  for (const g of ordered) {
    const gameScore = gameScoreFromFactors(g.factors);
    if (gameScore === null) continue; // not a completed game — skip
    const before = rating;
    rating = updateElo(rating, gameScore);
    history.push({
      sessionId: g.sessionId,
      at: g.at,
      gameScore,
      ratingBefore: before,
      ratingAfter: rating,
      delta: rating - before,
    });
  }
  return {
    rating,
    gamesPlayed: history.length,
    provisional: history.length < PROVISIONAL_GAMES,
    history,
  };
}

/**
 * Fetch an agent's ELO games from their after-pitch summaries (the rating +
 * quality) joined with the session outcome. Reads the owner-private
 * after_pitch_summaries via the ADMIN client — the CALLER (route) is responsible
 * for verifying the viewer may see this agent's rating (the rep themselves, or a
 * same-company manager/admin). The ELO number is a growth metric; the raw
 * per-call private scores are NOT returned here.
 */
export async function getAgentEloGames(agentId: string): Promise<EloGame[]> {
  const admin = createAdminClient();

  // 1. DISSECTS — the primary quality signal (founder 2026-07-07: use the reps'
  //    existing valid session calls). Actor-keyed events, subject = the session.
  const { data: dissectEvents, error: dissectErr } = await admin
    .from("events")
    .select("subject, payload, created_at")
    .eq("kind", "coach.dissect_generated")
    .eq("actor", agentId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (dissectErr) {
    // §3.4 / live-error-vs-empty: a swallowed error here silently thins the rating.
    // eslint-disable-next-line no-console
    console.error(
      `[salesElo.getAgentEloGames] dissect read failed agent=${agentId}: ${dissectErr.message}`
    );
  }

  // 2. AFTER-PITCH SCORES — used where they exist (the numeric rating), else the
  //    dissect quality stands alone.
  const { data: aps, error: apsErr } = await admin
    .from("after_pitch_summaries")
    .select("session_id, payload, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (apsErr) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesElo.getAgentEloGames] after-pitch read failed agent=${agentId}: ${apsErr.message}`
    );
  }

  // Latest dissect per session → strengths / growth counts (the quality signal).
  const dissectBySession = new Map<
    string,
    { strengths: number; growthAreas: number; at: string }
  >();
  for (const e of dissectEvents ?? []) {
    const subject = (e.subject as string | null) ?? "";
    const prefix = "sales_session:";
    if (!subject.startsWith(prefix)) continue;
    const sid = subject.slice(prefix.length);
    if (dissectBySession.has(sid)) continue; // desc order → first is latest
    const p = (e.payload ?? {}) as { strengths?: unknown; growth_areas?: unknown };
    dissectBySession.set(sid, {
      strengths: Array.isArray(p.strengths) ? p.strengths.length : 0,
      growthAreas: Array.isArray(p.growth_areas) ? p.growth_areas.length : 0,
      at: (e.created_at as string) ?? "",
    });
  }

  // Latest after-pitch scores per session.
  const scoresBySession = new Map<string, ScoreCategory[]>();
  for (const row of aps ?? []) {
    const sid = row.session_id as string;
    if (scoresBySession.has(sid)) continue;
    const payload = (row.payload ?? {}) as { scores?: unknown };
    scoresBySession.set(
      sid,
      Array.isArray(payload.scores) ? (payload.scores as ScoreCategory[]) : []
    );
  }

  const sessionIds = new Set<string>([
    ...dissectBySession.keys(),
    ...scoresBySession.keys(),
  ]);
  if (sessionIds.size === 0) return [];

  const { data: sessions, error: sessErr } = await admin
    .from("coaching_sessions")
    .select("id, outcome, ended_at, started_at")
    .in("id", [...sessionIds]);
  if (sessErr) {
    // The MOST consequential swallow: an error here empties sessMap, so EVERY game
    // loses its outcome + timestamp and the rating is materially wrong yet looks
    // authoritative. Log it loudly (§3.4 — a wrong rating must be diagnosable, not
    // silent). A fail-closed rating signal is the deeper fix (flagged in the report).
    // eslint-disable-next-line no-console
    console.error(
      `[salesElo.getAgentEloGames] sessions read FAILED agent=${agentId} — rating will be computed WITHOUT outcomes: ${sessErr.message}`
    );
  }
  const sessMap = new Map((sessions ?? []).map((s) => [s.id as string, s]));

  const games: EloGame[] = [];
  for (const sid of sessionIds) {
    const sess = sessMap.get(sid);
    const dissect = dissectBySession.get(sid);
    // Consistent chronological key across ALL games (audit 2026-07-09 A4): use
    // started_at uniformly (always present when the session row exists) instead of
    // mixing ended_at for some sessions and started_at for others. The ELO replay is
    // path-dependent (updateElo applies games in order), so a mixed key can invert
    // order and change the final rating. dissect.at only when the session row is absent.
    const at = (sess?.started_at ?? dissect?.at ?? "") as string;
    if (!at) continue; // no timestamp to order by — skip
    games.push({
      sessionId: sid,
      at,
      factors: {
        scores: scoresBySession.get(sid) ?? [],
        strengths: dissect?.strengths ?? 0,
        growthAreas: dissect?.growthAreas ?? 0,
        outcome: (sess?.outcome ?? null) as SalesOutcome | null,
      },
    });
  }
  return games;
}

/** Fetch + replay in one call. Route-gated. */
export async function getAgentEloRating(agentId: string): Promise<AgentElo> {
  return computeAgentElo(await getAgentEloGames(agentId));
}
