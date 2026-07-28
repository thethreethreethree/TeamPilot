import { describe, it, expect } from "vitest";
import { formatInTimeZone, resolveTimeZone } from "../format";

const NOON_UTC = "2026-01-15T12:00:00Z";

describe("formatInTimeZone", () => {
  it("returns '' for empty / null / unparseable input (never throws)", () => {
    expect(formatInTimeZone("")).toBe("");
    expect(formatInTimeZone(null)).toBe("");
    expect(formatInTimeZone(undefined)).toBe("");
    expect(formatInTimeZone("not a date")).toBe("");
  });

  it("actually honors the timezone — the same instant renders differently in different zones", () => {
    // The whole point of the util: before this, timezone was ignored. Manila (UTC+8)
    // and New York (UTC-5) are on different clock hours at noon UTC.
    const manila = formatInTimeZone(NOON_UTC, "Asia/Manila");
    const newYork = formatInTimeZone(NOON_UTC, "America/New_York");
    expect(manila).not.toBe("");
    expect(manila).not.toBe(newYork);
  });

  it("degrades to local time (no throw, non-empty) for an invalid IANA zone", () => {
    const out = formatInTimeZone(NOON_UTC, "Mars/Phobos");
    expect(out.length).toBeGreaterThan(0);
  });

  it("supports date-only and time-only styles", () => {
    expect(formatInTimeZone(NOON_UTC, "UTC", "date")).not.toContain(":");
    expect(formatInTimeZone(NOON_UTC, "UTC", "time")).toContain(":");
  });
});

describe("resolveTimeZone (user -> company -> browser)", () => {
  it("prefers the user override", () => {
    expect(resolveTimeZone("Asia/Tokyo", "Europe/London")).toBe("Asia/Tokyo");
  });
  it("falls back to the company timezone", () => {
    expect(resolveTimeZone(null, "Europe/London")).toBe("Europe/London");
  });
  it("returns undefined (browser-local) when neither is set", () => {
    expect(resolveTimeZone(null, null)).toBeUndefined();
    expect(resolveTimeZone(undefined, undefined)).toBeUndefined();
  });
  it("ignores blank/whitespace values", () => {
    expect(resolveTimeZone("   ", "UTC")).toBe("UTC");
    expect(resolveTimeZone("", "")).toBeUndefined();
  });
});
