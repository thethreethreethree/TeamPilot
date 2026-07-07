import { describe, expect, it } from "vitest";
import {
  outcomeValue,
  gameScoreFromFactors,
  expectedScore,
  updateElo,
  computeAgentElo,
  STARTING_RATING,
  OPPONENT_RATING,
  type EloFactors,
  type EloGame,
} from "../salesElo";
import type { ScoreCategory } from "../summaryTypes";

const score = (n: number): ScoreCategory =>
  ({ key: "opener", label: "Opener", score: n, display: `${n}/10`, rationale: "r", citation: null, computed: false });

const factors = (over: Partial<EloFactors> = {}): EloFactors => ({
  scores: [score(7), score(7)],
  strengths: 3,
  growthAreas: 1,
  outcome: "follow_up",
  ...over,
});

describe("outcomeValue — the consequence half (§3.5)", () => {
  it("maps outcomes to 0..1, sold highest", () => {
    expect(outcomeValue("sold")).toBe(1);
    expect(outcomeValue("follow_up")).toBe(0.7);
    expect(outcomeValue("undecided")).toBe(0.5);
    expect(outcomeValue("no_sale")).toBe(0.35);
  });
  it("no_contact is NOT a game (null) — nothing happened", () => {
    expect(outcomeValue("no_contact")).toBeNull();
    expect(outcomeValue(null)).toBeNull();
  });
});

describe("gameScoreFromFactors — balanced consequence + performance", () => {
  it("computes a 0..1 balanced score", () => {
    // scores mean = 7/10 = .7; quality = 3/4 = .75; perf = .5*.7+.5*.75 = .725
    // outcome follow_up = .7; game = .5*.7 + .5*.725 = .7125
    const g = gameScoreFromFactors(factors());
    expect(g).toBeCloseTo(0.7125, 4);
  });
  it("a sale scores higher than a no-sale, all else equal", () => {
    const sold = gameScoreFromFactors(factors({ outcome: "sold" }))!;
    const lost = gameScoreFromFactors(factors({ outcome: "no_sale" }))!;
    expect(sold).toBeGreaterThan(lost);
  });
  it("returns null when there is no outcome (not a completed game)", () => {
    expect(gameScoreFromFactors(factors({ outcome: null }))).toBeNull();
    expect(gameScoreFromFactors(factors({ outcome: "no_contact" }))).toBeNull();
  });
  it("returns null when there are no scores to rate", () => {
    expect(gameScoreFromFactors(factors({ scores: [] }))).toBeNull();
  });
  it("neutral quality (0.5) when the review had neither strengths nor growth", () => {
    // perf = .5*.7 + .5*.5 = .6 ; game = .5*.7 + .5*.6 = .65
    const g = gameScoreFromFactors(factors({ strengths: 0, growthAreas: 0 }))!;
    expect(g).toBeCloseTo(0.65, 4);
  });
});

describe("ELO update math", () => {
  it("expected score is 0.5 at equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 6);
  });
  it("beating the standard (game > expected) raises the rating", () => {
    expect(updateElo(1500, 1)).toBeGreaterThan(1500);
  });
  it("losing to the standard lowers it", () => {
    expect(updateElo(1500, 0)).toBeLessThan(1500);
  });
  it("a game score exactly at expected holds the rating", () => {
    // at equal ratings expected = 0.5; a 0.5 game leaves it unchanged
    expect(updateElo(1500, 0.5)).toBe(1500);
  });
});

describe("computeAgentElo — replay against the standard", () => {
  const game = (id: string, at: string, over: Partial<EloFactors> = {}): EloGame => ({
    sessionId: id,
    at,
    factors: factors(over),
  });

  it("starts at 1500 and is provisional under 5 games", () => {
    const r = computeAgentElo([game("a", "2026-07-01T00:00:00Z", { outcome: "sold" })]);
    expect(r.gamesPlayed).toBe(1);
    expect(r.provisional).toBe(true);
    expect(r.rating).toBeGreaterThan(STARTING_RATING); // a sale beats the standard
    expect(r.history[0]!.ratingBefore).toBe(1500);
  });

  it("skips non-games (no outcome / no_contact) — they don't count", () => {
    const r = computeAgentElo([
      game("a", "2026-07-01T00:00:00Z", { outcome: "sold" }),
      game("b", "2026-07-02T00:00:00Z", { outcome: "no_contact" }),
      game("c", "2026-07-03T00:00:00Z", { outcome: null }),
    ]);
    expect(r.gamesPlayed).toBe(1);
  });

  it("replays in chronological order regardless of input order", () => {
    const unordered = [
      game("late", "2026-07-05T00:00:00Z", { outcome: "sold" }),
      game("early", "2026-07-01T00:00:00Z", { outcome: "no_sale" }),
    ];
    const r = computeAgentElo(unordered);
    expect(r.history.map((h) => h.sessionId)).toEqual(["early", "late"]);
  });

  it("clears provisional at 5 games", () => {
    const games = Array.from({ length: 5 }, (_, i) =>
      game(`g${i}`, `2026-07-0${i + 1}T00:00:00Z`, { outcome: "sold" })
    );
    const r = computeAgentElo(games);
    expect(r.gamesPlayed).toBe(5);
    expect(r.provisional).toBe(false);
  });

  it("uses the fixed standard as the opponent", () => {
    expect(OPPONENT_RATING).toBe(1500);
  });
});
