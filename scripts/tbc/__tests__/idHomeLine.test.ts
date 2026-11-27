import { describe, it, expect } from "vitest";
import { exactIdRe, idHomeLine } from "../lib.mjs";

/** The stale-range note points at a section's heading, and "3.1" never matches inside "3.1.1" (2026-11-27). */
const doc = ["# Title", "see (§3.1) here", "## 3. How", "### 3.1 Data", "### 3.1.1 Erasure", "## A19 thing", "A19 again", "§0 cited", "## 0. The One Law"];
describe("idHomeLine", () => {
  it("prefers the heading over an earlier mention", () => {
    expect(idHomeLine(doc, "§3.1")).toBe(4);
    expect(idHomeLine(doc, "§3.1.1")).toBe(5);
    expect(idHomeLine(doc, "A19")).toBe(6);
    expect(idHomeLine(doc, "§0")).toBe(9); // "## 0. The One Law"
    expect(idHomeLine(doc, "§3")).toBe(3); // "## 3. How", not "### 3.1"
  });
  it("falls back to the first exact mention; 0 when absent", () => {
    expect(idHomeLine(["x 9.9 y"], "9.9")).toBe(1);
    expect(idHomeLine(["only 3.1.1 here"], "§3.1")).toBe(0);
  });
  it("exact match: 3.1 is not 3.1.1", () => {
    expect(exactIdRe("§3.1").test("### 3.1.1 Erasure")).toBe(false);
    expect(exactIdRe("§3.1").test("### 3.1 Data")).toBe(true);
  });
});
