import { describe, it, expect } from 'vitest';
import { timedSegments, computeInteractionStats, talkTimeLanes, isQuestion, SegmentError, type Segment } from '../stats';

const seg = (speaker: Segment['speaker'], startS: number, endS: number, text = 'ok then'): Segment => ({ speaker, startMs: startS * 1000, endMs: endS * 1000, text });

describe('interaction stats', () => {
  const call: Segment[] = [
    seg('rep', 0, 30, 'Hi, thanks for taking the call.'),
    seg('rep', 31, 60, 'Let me explain the plan.'), // same speaker: one 59 s stretch of speech (60 s span, 59 s spoken)
    seg('customer', 61, 100, 'We pay too much today.'),
    seg('rep', 101, 110, 'What do you pay now?'),
    seg('customer', 112, 120, 'About eighty.'),
    seg('rep', 121, 125, 'Would you switch this week?'),
  ];
  const st = computeInteractionStats(call);

  it('computes talk ratio by time (rep 72 s of 119 s known speech)', () => {
    expect(st.speechMsBySpeaker.rep).toBe(72_000);
    expect(st.speechMsBySpeaker.customer).toBe(47_000);
    expect(st.talkRatioTime!).toBeCloseTo(72 / 119, 6);
  });
  it('merges consecutive rep segments into one monologue', () => {
    expect(st.longestRepMonologueMs).toBe(59_000);
    expect(st.longestCustomerStoryMs).toBe(39_000);
  });
  it('takes the median customer-to-rep pause as patience', () => {
    expect(st.patienceMs).toBe(1000); // gaps 1 s and 1 s
  });
  it('counts rep questions per hour of session', () => {
    expect(st.repQuestionsPerHour).toBeCloseTo((2 / 125) * 3600, 1);
  });
  it('gives no talk ratio, interactivity or patience when only the rep spoke', () => {
    const solo = computeInteractionStats([seg('rep', 0, 10)]);
    expect(solo.talkRatioTime).toBe(1);
    expect(solo.interactivity).toBeNull();
    expect(solo.patienceMs).toBeNull();
  });
  it('ignores an "mm-hm" when counting speaker switches', () => {
    const withAck = computeInteractionStats([seg('rep', 0, 20), { speaker: 'customer', startMs: 20_100, endMs: 20_600, text: 'mm' }, seg('rep', 21, 40), seg('customer', 41, 50)]);
    expect(withAck.interactivity).toBe(1); // rep -> customer once; the ack is not a switch
  });
  it('refuses a segment with no duration', () => {
    expect(() => computeInteractionStats([seg('rep', 5, 5)])).toThrow(SegmentError);
  });
  it('builds one lane per speaker for the talk-time bar', () => {
    expect(talkTimeLanes(call).customer).toEqual([[61_000, 100_000], [112_000, 120_000]]);
  });
  it('detects questions by "?" or an interrogative opener, not statements', () => {
    expect(isQuestion('how much do you pay')).toBe(true);
    expect(isQuestion('I see.')).toBe(false);
  });
});

describe('timedSegments (RSS Phase 2: stored end times, estimated old calls)', () => {
  const S = '2026-11-15T10:00:00.000Z';
  const at = (s: number) => new Date(Date.parse(S) + s * 1000).toISOString();

  it('uses stored end times and says nothing was estimated', () => {
    const r = timedSegments([
      { speaker: 'agent', text: 'Hi', spoken_at: at(0), ended_at: at(2) },
      { speaker: 'customer', text: 'Hello', spoken_at: at(3), ended_at: at(5) },
    ], S, 6);
    expect(r).toEqual({
      segments: [
        { speaker: 'rep', startMs: 0, endMs: 2000, text: 'Hi' },
        { speaker: 'customer', startMs: 3000, endMs: 5000, text: 'Hello' },
      ],
      estimated: false,
      untimed: 0,
    });
  });

  it('estimates a missing end as the next start, or the audio end for the last line — and says so', () => {
    const r = timedSegments([
      { speaker: 'agent', text: 'Hi', spoken_at: at(0) },
      { speaker: 'customer', text: 'Hello', spoken_at: at(4) },
    ], S, 10);
    expect(r.segments.map((s) => [s.startMs, s.endMs])).toEqual([[0, 4000], [4000, 10000]]);
    expect(r.estimated).toBe(true);
  });

  it('a line with no time, or no way to end it, is left out and counted', () => {
    const r = timedSegments([
      { speaker: 'agent', text: 'a', spoken_at: null },
      { speaker: 'agent', text: 'b', spoken_at: at(1) },
    ], S, null);
    expect(r.segments).toEqual([]);
    expect(r.untimed).toBe(2);
  });
});
