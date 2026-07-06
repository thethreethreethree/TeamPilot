import { describe, expect, it } from "vitest";
import { constantTimeEqual } from "../constantTime";

describe("constantTimeEqual — secret comparison", () => {
  it("returns true only for an exact match", () => {
    expect(constantTimeEqual("s3cr3t-abc", "s3cr3t-abc")).toBe(true);
    expect(constantTimeEqual("Bearer tok-123", "Bearer tok-123")).toBe(true);
  });

  it("returns false for any mismatch (incl. differing length)", () => {
    expect(constantTimeEqual("s3cr3t-abc", "s3cr3t-abd")).toBe(false);
    expect(constantTimeEqual("short", "longer-secret")).toBe(false);
    expect(constantTimeEqual("", "x")).toBe(false);
  });

  it("returns false for missing inputs (never throws)", () => {
    expect(constantTimeEqual(null, "x")).toBe(false);
    expect(constantTimeEqual("x", undefined)).toBe(false);
    expect(constantTimeEqual(null, null)).toBe(false);
    expect(constantTimeEqual(undefined, undefined)).toBe(false);
  });

  it("handles empty-string equality", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
