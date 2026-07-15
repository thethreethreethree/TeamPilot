import { describe, it, expect } from "vitest";
import {
  isWithinObserveWindow,
  observeWindowEndsAt,
  OBSERVE_WINDOW_MS,
} from "../observeWindow";

/**
 * Pins the 3-day silent-observe boundary (spec 4.3a, §3.4). The whole value of
 * this feature is the EDGE: a window that fires a day early advises before there's
 * a baseline; one that lingers a day late keeps a ready rep silent. These tests
 * make the edge explicit so it can't drift.
 */

const START = "2026-07-15T09:00:00.000Z";
const startMs = Date.parse(START);

describe("isWithinObserveWindow — the edge is the point", () => {
  it("is in-window one hour in", () => {
    expect(isWithinObserveWindow(START, startMs + 60 * 60 * 1000)).toBe(true);
  });

  it("is in-window one millisecond before the boundary", () => {
    expect(isWithinObserveWindow(START, startMs + OBSERVE_WINDOW_MS - 1)).toBe(true);
  });

  it("is OUT of window exactly AT the boundary (advice starts, never held a tick too long)", () => {
    expect(isWithinObserveWindow(START, startMs + OBSERVE_WINDOW_MS)).toBe(false);
  });

  it("is out of window a day after it closes", () => {
    expect(isWithinObserveWindow(START, startMs + OBSERVE_WINDOW_MS + 86_400_000)).toBe(false);
  });

  it("treats a future start (clock skew) as in-window — we haven't begun observing", () => {
    expect(isWithinObserveWindow(START, startMs - 1000)).toBe(true);
  });

  it("is NOT in-window when there is no recorded start (§3.4 — never suppress on a date we don't have)", () => {
    expect(isWithinObserveWindow(null, startMs)).toBe(false);
    expect(isWithinObserveWindow(undefined, startMs)).toBe(false);
  });

  it("is NOT in-window for a malformed date (honest fallback, not silent suppression)", () => {
    expect(isWithinObserveWindow("not-a-date", startMs)).toBe(false);
  });
});

describe("observeWindowEndsAt — the notice matches the suppression exactly", () => {
  it("ends exactly OBSERVE_WINDOW_MS after the start", () => {
    expect(observeWindowEndsAt(START)).toBe(
      new Date(startMs + OBSERVE_WINDOW_MS).toISOString()
    );
  });
  it("is null with no start to anchor it", () => {
    expect(observeWindowEndsAt(null)).toBeNull();
    expect(observeWindowEndsAt("bad")).toBeNull();
  });
});
