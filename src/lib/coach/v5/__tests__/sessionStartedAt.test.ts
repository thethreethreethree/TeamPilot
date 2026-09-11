import { describe, expect, it } from "vitest";
import {
  MAX_BACKDATE_MS,
  MAX_SKEW_MS,
  sessionStartedAt,
} from "../sessionStartedAt";

/**
 * When the conversation happened, as opposed to when the phone got signal.
 *
 * A session's `started_at` was always the moment the row was inserted, which is correct for the web
 * and wrong for the phone: a recording waits on the device until there is a bar, so the create route
 * is reached at UPLOAD. A call recorded on the 4th and sent on the 11th became a session dated the
 * 11th, and the rep's own history said the conversation happened on a day it did not.
 *
 * The value comes from a phone's clock, so the load-bearing tests are the two refusals. A device set
 * ahead pins a call to the top of every time-ordered list for ever; a device set back files it where
 * nobody will see it again. Both are worse than the fallback, which is simply the behaviour that
 * existed before this function.
 */
const NOW = new Date("2026-09-11T09:00:00.000Z");

describe("sessionStartedAt", () => {
  it("believes a recording made days ago, which is the whole point", () => {
    // The founder's own backlog: recordings held on a phone for days before there was signal.
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(sessionStartedAt(sevenDaysAgo, NOW)).toBe(sevenDaysAgo);
  });

  it("believes a recording made moments ago", () => {
    const justNow = new Date(NOW.getTime() - 30_000).toISOString();
    expect(sessionStartedAt(justNow, NOW)).toBe(justNow);
  });

  it("refuses a start in the future, which is the more damaging direction", () => {
    // A session dated ahead sits at the top of every list ordered by time and stays there.
    const ahead = new Date(NOW.getTime() + MAX_SKEW_MS + 1000).toISOString();
    expect(sessionStartedAt(ahead, NOW)).toBeNull();
  });

  it("allows ordinary clock skew between a phone and this server", () => {
    const slightlyAhead = new Date(NOW.getTime() + MAX_SKEW_MS - 1000).toISOString();
    expect(sessionStartedAt(slightlyAhead, NOW)).toBe(slightlyAhead);
  });

  it("refuses a start so old it can only be a broken clock", () => {
    const ancient = new Date(NOW.getTime() - MAX_BACKDATE_MS - 1000).toISOString();
    expect(sessionStartedAt(ancient, NOW)).toBeNull();
  });

  it("covers the longest a real recording has actually waited", () => {
    // 47 days is the oldest observed in production (the recovery sweep's record, 2026-09-10). The
    // window is set from that measurement rather than from taste, so this pins the relationship.
    const fortySevenDays = 47 * 24 * 60 * 60 * 1000;
    expect(MAX_BACKDATE_MS).toBeGreaterThan(fortySevenDays);
    const oldButReal = new Date(NOW.getTime() - fortySevenDays).toISOString();
    expect(sessionStartedAt(oldButReal, NOW)).toBe(oldButReal);
  });

  it("refuses anything that is not a usable instant", () => {
    expect(sessionStartedAt(undefined, NOW)).toBeNull();
    expect(sessionStartedAt(null, NOW)).toBeNull();
    expect(sessionStartedAt("", NOW)).toBeNull();
    expect(sessionStartedAt("   ", NOW)).toBeNull();
    expect(sessionStartedAt("not a date", NOW)).toBeNull();
    expect(sessionStartedAt(1757580000000, NOW)).toBeNull();
  });

  it("normalises to one stored shape, whatever offset the phone expressed it in", () => {
    // The same moment, written two ways. A session's stored instant should not carry the timezone
    // the device happened to be in when it recorded.
    const utc = "2026-09-10T16:53:00.000Z";
    const offset = "2026-09-11T00:53:00.000+08:00";
    expect(sessionStartedAt(offset, NOW)).toBe(utc);
    expect(sessionStartedAt(utc, NOW)).toBe(utc);
  });

  it("never throws on a nonsense clock", () => {
    // `now` comes from the server so it is sound, but a function that decides whether to trust a
    // timestamp must not be the thing that falls over when given a bad one.
    expect(sessionStartedAt("2026-09-10T16:53:00.000Z", new Date(NaN))).toBeNull();
  });
});
