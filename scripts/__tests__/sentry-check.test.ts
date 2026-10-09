import { describe, it, expect } from "vitest";
// @ts-expect-error — a plain .mjs script, no type declarations
import { parseDsn } from "../sentry-check.mjs";

/** The DSN parser behind scripts/sentry-check.mjs (2026-10-08). */
describe("parseDsn", () => {
  it("reads key, host and project from a current-format DSN (regional host included)", () => {
    expect(parseDsn("https://abc123@o4507.ingest.us.sentry.io/4509")).toEqual({
      key: "abc123",
      host: "o4507.ingest.us.sentry.io",
      protocol: "https:",
      projectId: "4509",
    });
  });

  it.each(["not-a-dsn", "https://o1.ingest.sentry.io/123", "https://abc@o1.ingest.sentry.io/notnumeric", ""])(
    "refuses %s",
    (dsn) => {
      expect(parseDsn(dsn)).toBeNull();
    }
  );
});
