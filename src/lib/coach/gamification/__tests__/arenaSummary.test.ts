import { describe, it, expect } from "vitest";
import { deriveArena, type ArenaRow } from "../arenaSummary";

const NOW = Date.parse("2026-09-03T00:00:00Z");
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const row = (points: number, daysAgo: number, id = `s${points}-${daysAgo}`): ArenaRow => ({
  session_id: id,
  points,
  band: null,
  created_at: day(daysAgo),
});

describe("deriveArena", () => {
  it("gauge band comes from the AVG; strong counts sessions >= 80", () => {
    const s = deriveArena({
      rows: [row(90, 1), row(60, 2), row(30, 3)],
      total: 180, avg: 60, sessions: 3, best: 90, deals: 2, rank: 1, nowMs: NOW,
    });
    expect(s.band).toBe("solid"); // avg 60
    expect(s.bandLabel).toBe("Solid");
    expect(s.strong).toBe(1); // only the 90
  });

  it("records are the top-3 by points, newest-within-7-days flagged NEW, with the band floor", () => {
    const s = deriveArena({
      rows: [row(84, 1), row(92, 2), row(70, 3), row(88, 30)],
      total: 334, avg: 83, sessions: 4, best: 92, deals: 0, rank: 2, nowMs: NOW,
    });
    expect(s.records.map((r) => r.row.points)).toEqual([92, 88, 84]); // top 3, points desc
    expect(s.records[0]).toMatchObject({ band: "elite", bandLabel: "Elite", isNew: true, floor: 90 });
    expect(s.records[1]!.isNew).toBe(false); // 88 was 30 days ago
    expect(s.records[2]).toMatchObject({ band: "strong", floor: 80 });
  });

  it("bars are the most-recent 7 sessions in order", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(50 + i, 10 - i, `x${i}`));
    const s = deriveArena({ rows, total: 0, avg: 55, sessions: 10, best: 59, deals: 0, rank: null, nowMs: NOW });
    expect(s.bars).toHaveLength(7);
    expect(s.bars[0]!.session_id).toBe("x3"); // oldest 3 dropped
    expect(s.bars[6]!.session_id).toBe("x9"); // latest kept
  });

  it("milestones flip on their thresholds", () => {
    const s = deriveArena({
      rows: [row(85, 1)], total: 85, avg: 85, sessions: 1, best: 85, deals: 1, rank: 1, nowMs: NOW,
    });
    const on = Object.fromEntries(s.milestones.map((m) => [m.key, m.on]));
    expect(on).toMatchObject({ spark: true, flame: true, deal: true, century: false, closer: false });
  });

  it("falls back to the rep's own history when the leaderboard row is absent (best null, deals null)", () => {
    const s = deriveArena({
      rows: [row(70, 1), row(96, 2)], total: 166, avg: 83, sessions: 2, best: null, deals: null, rank: null, nowMs: NOW,
    });
    expect(s.best).toBe(96); // max of the rep's own rows
    expect(s.deals).toBe(0); // null deals → 0, and its milestones stay off
    expect(s.milestones.find((m) => m.key === "deal")!.on).toBe(false);
  });
});
