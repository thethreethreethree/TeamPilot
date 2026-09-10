/**
 * Regression tests for the team scoreboard.
 *
 * THE RANK IS POSITIONAL, and that is a deliberate choice against my own
 * judgement. `/api/coach/gamification/leaderboard` computes `meRank` as
 * `meIndex + 1`, so two reps on identical points get different numbers and the
 * lower-placed one is told they came second. I argued for competition ranking —
 * a shared rank for a tie — and the owner's overriding requirement is that the
 * app and the website agree. A rep reading "1st" in one and "2nd" in the other
 * is a worse failure than an unfair tiebreak, so these tests pin the WEB's
 * behaviour and the argument sits on the decision board.
 *
 * A REP WITH NO NAME IS STILL ON THE BOARD. `full_name` is left-joined and can
 * be null. Filtering those rows out would silently shrink the team and shift
 * everybody else's rank — a rep would be told they are third when they are
 * fourth.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { myRank, rank, type LeaderboardRow } from '@/lib/gamification/leaderboard';

const row = (
  agentId: string,
  totalPoints: number,
  fullName: string | null = `Rep ${agentId}`,
): LeaderboardRow => ({
  agentId,
  fullName,
  sessions: 3,
  totalPoints,
  avgPoints: 50,
  bestPoints: 70,
  deals: 1,
});

test('ranks run 1, 2, 3 when nobody ties', () => {
  const r = rank([row('a', 90), row('b', 80), row('c', 70)], null);
  assert.deepEqual(r.map((x) => x.rank), [1, 2, 3]);
});

/*
 * CHANGED 4 September 2026, by the owner's decision on the build board.
 *
 * These three tests previously pinned POSITIONAL ranking — `meIndex + 1`, the
 * route's formula — so the second of two identical reps read as 2nd. I had
 * argued that was false and brought it to the owner rather than changing it
 * quietly; they chose competition ranking, on BOTH the app and the website.
 *
 * They are rewritten, not deleted. They were correct when written and they
 * failed the moment the behaviour changed, which is exactly what they were for.
 */
test('a tie SHARES a rank, and the next place skips', () => {
  const r = rank([row('a', 90), row('b', 90), row('c', 70)], null);
  assert.deepEqual(r.map((x) => x.rank), [1, 1, 3]);
});

test('a three-way tie shares one rank', () => {
  const r = rank([row('a', 50), row('b', 50), row('c', 50)], null);
  assert.deepEqual(r.map((x) => x.rank), [1, 1, 1]);
});

test('the caller’s own rank uses the same shared-tie rule as everyone else', () => {
  // Previously asserted the route's meIndex + 1. The owner chose competition
  // ranking on both sides; until the website is changed to match, a tied rep
  // reads the kinder number here and the harsher one there — the direction the
  // owner chose to be wrong in while the two catch up.
  const rows = [row('a', 90), row('b', 90), row('c', 70)];
  const ranked = rank(rows, 'b');
  // 'b' is tied with 'a' on 90, so they share 1st — not 2nd, which is what
  // meIndex + 1 would have said.
  assert.equal(myRank(ranked)?.rank, 1);
  assert.equal(myRank(ranked)?.isYou, true);
});

test('a rep with no name is KEPT, not dropped', () => {
  // Dropping them would shift everybody else's rank.
  const r = rank([row('a', 90), row('b', 80, null), row('c', 70)], null);
  assert.equal(r.length, 3);
  assert.equal(r[1].displayName, 'A teammate');
  assert.deepEqual(r.map((x) => x.rank), [1, 2, 3]);
});

test('a blank name is treated as no name', () => {
  const r = rank([row('a', 90, '   ')], null);
  assert.equal(r[0].displayName, 'A teammate');
});

test('your own row is marked, and only yours', () => {
  const r = rank([row('a', 90), row('b', 80)], 'b');
  assert.deepEqual(r.map((x) => x.isYou), [false, true]);
});

test('nobody is marked when the viewer is unknown', () => {
  const r = rank([row('a', 90), row('b', 80)], null);
  assert.equal(r.some((x) => x.isYou), false);
});

test('your rank is findable, and is null when you are not on the board', () => {
  const r = rank([row('a', 90), row('b', 80)], 'b');
  assert.equal(myRank(r)?.rank, 2);
  assert.equal(myRank(rank([row('a', 90)], 'zzz')), null);
});

test('an empty board is empty, not a crash', () => {
  assert.deepEqual(rank([], 'me'), []);
  assert.equal(myRank([]), null);
});

test('zero points still earns a place on the board', () => {
  // A rep who has been scored and got nothing is on the board; a rep with no
  // sessions simply does not appear. The function decides that, not this.
  const r = rank([row('a', 10), row('b', 0)], null);
  assert.deepEqual(r.map((x) => x.rank), [1, 2]);
});

test('a board row carries the band of its AVERAGE, not its total', () => {
  // Totals are unbounded; a band is defined over 0-100. Banding the total would
  // put every established rep in "elite" on volume alone.
  const r = rank([{ ...row('a', 3604), sessions: 57, avgPoints: 63.2 }], null);
  assert.equal(r[0].band, 'solid');
});

test('a rep with no scored session has NO band on the board', () => {
  // Not "needs coaching". They have not been judged.
  const r = rank([{ ...row('a', 0), sessions: 0, avgPoints: 0 }], null);
  assert.equal(r[0].band, null);
});

test('two reps tied on every key do not swap places between reads', () => {
  // The RPC orders by total, avg, sessions and stops. Since avg = total /
  // sessions, an equal total AND an equal session count ties all three — so
  // Postgres may return the pair either way round, and the app ranks by
  // position. Without a final tiebreak a rep reads 1st, refreshes, reads 2nd.
  const a: LeaderboardRow = {
    agentId: 'aaa', fullName: 'Ana', sessions: 3,
    totalPoints: 200, avgPoints: 66, bestPoints: 80, deals: 1,
  };
  const b: LeaderboardRow = { ...a, agentId: 'bbb', fullName: 'Ben' };

  const forward = rank([a, b], null).map((r) => r.agentId);
  const reversed = rank([b, a], null).map((r) => r.agentId);
  assert.deepEqual(forward, reversed, 'the same two reps ranked differently by arrival order');
});

test('the deterministic tiebreak never reorders reps the server separated', () => {
  // It must only settle the case the server leaves open. A rep the server put
  // ahead on points must stay ahead, whatever their id sorts like.
  const leader: LeaderboardRow = {
    agentId: 'zzz', fullName: 'Zoe', sessions: 2,
    totalPoints: 500, avgPoints: 250, bestPoints: 260, deals: 3,
  };
  const trailer: LeaderboardRow = {
    agentId: 'aaa', fullName: 'Ana', sessions: 2,
    totalPoints: 100, avgPoints: 50, bestPoints: 60, deals: 0,
  };
  // 'zzz' sorts last alphabetically, so a naive id sort would demote the leader.
  assert.deepEqual(rank([leader, trailer], null).map((r) => r.rank), [1, 2]);
  assert.equal(rank([trailer, leader], null)[0].agentId, 'zzz');
});

test('ranking does not mutate the array the screen is holding', () => {
  const rows: LeaderboardRow[] = [
    { agentId: 'b', fullName: 'B', sessions: 1, totalPoints: 10, avgPoints: 10, bestPoints: 10, deals: 0 },
    { agentId: 'a', fullName: 'A', sessions: 1, totalPoints: 90, avgPoints: 90, bestPoints: 90, deals: 0 },
  ];
  const before = rows.map((r) => r.agentId);
  rank(rows, null);
  assert.deepEqual(rows.map((r) => r.agentId), before, 'rank() reordered its input in place');
});

test('two reps on identical points SHARE a rank', () => {
  // The owner's decision. Telling one of two identical reps they came second is
  // false, and it is the kind of thing a person remembers.
  const a: LeaderboardRow = {
    agentId: 'aaa', fullName: 'Ana', sessions: 3,
    totalPoints: 200, avgPoints: 66, bestPoints: 80, deals: 1,
  };
  const b: LeaderboardRow = { ...a, agentId: 'bbb', fullName: 'Ben' };
  const ranks = rank([a, b], null).map((r) => r.rank);
  assert.deepEqual(ranks, [1, 1]);
});

test('the rank after a tie skips, so 3rd really is third', () => {
  // 1, 2, 2, 4 — not 1, 2, 2, 3. Without the skip a rep ranked 3rd of five
  // appears to be beating three people when they are beating two.
  const mk = (id: string, totalPoints: number): LeaderboardRow => ({
    agentId: id, fullName: id, sessions: 2,
    totalPoints, avgPoints: totalPoints / 2, bestPoints: totalPoints, deals: 0,
  });
  const ranks = rank([mk('a', 300), mk('b', 200), mk('c', 200), mk('d', 100)], null).map((r) => r.rank);
  assert.deepEqual(ranks, [1, 2, 2, 4]);
});

test('a three-way tie shares one rank and the next skips to fourth', () => {
  const mk = (id: string, totalPoints: number): LeaderboardRow => ({
    agentId: id, fullName: id, sessions: 1,
    totalPoints, avgPoints: totalPoints, bestPoints: totalPoints, deals: 0,
  });
  const ranks = rank([mk('a', 50), mk('b', 50), mk('c', 50), mk('d', 10)], null).map((r) => r.rank);
  assert.deepEqual(ranks, [1, 1, 1, 4]);
});

test('reps on different totals are ranked plainly, with no sharing', () => {
  const mk = (id: string, totalPoints: number): LeaderboardRow => ({
    agentId: id, fullName: id, sessions: 1,
    totalPoints, avgPoints: totalPoints, bestPoints: totalPoints, deals: 0,
  });
  assert.deepEqual(rank([mk('a', 30), mk('b', 20), mk('c', 10)], null).map((r) => r.rank), [1, 2, 3]);
});

test('a tie on points shares a rank even when the averages differ', () => {
  // Same total, different session counts. Inventing a tiebreak the rep cannot
  // see on screen is how "why am I second?" starts.
  const a: LeaderboardRow = {
    agentId: 'aaa', fullName: 'Ana', sessions: 2,
    totalPoints: 100, avgPoints: 50, bestPoints: 60, deals: 0,
  };
  const b: LeaderboardRow = {
    agentId: 'bbb', fullName: 'Ben', sessions: 5,
    totalPoints: 100, avgPoints: 20, bestPoints: 30, deals: 0,
  };
  assert.deepEqual(rank([a, b], null).map((r) => r.rank), [1, 1]);
});
