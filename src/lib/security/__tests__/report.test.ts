import { describe, it, expect } from "vitest";
import { cleanReport, currentStatus } from "../report";

describe("cleanReport", () => {
  const ok = { summary: "Cross-company read", details: "GET /api/x with another company's id returns their calls." };
  it("accepts a report, trims, and turns blank optionals into null", () => {
    expect(cleanReport({ ...ok, affected: "  ", name: " Ana ", contact: "" })).toEqual({ summary: "Cross-company read", details: ok.details, affected: null, reporterName: "Ana", reporterContact: null });
  });
  it("refuses a short summary or details, and over-long optionals", () => {
    expect(cleanReport({ ...ok, summary: "hi" })).toHaveProperty("error");
    expect(cleanReport({ ...ok, details: "too short" })).toHaveProperty("error");
    expect(cleanReport({ ...ok, contact: "x".repeat(201) })).toHaveProperty("error");
    expect(cleanReport({ ...ok, name: 5 })).toHaveProperty("error");
  });
});

describe("currentStatus", () => {
  it("is the latest event per report", () => {
    const m = currentStatus([
      { report_id: "r1", status: "fixed", note: "patched", created_at: "2026-11-23T02:00:00Z" },
      { report_id: "r1", status: "triaged", note: null, created_at: "2026-11-23T01:00:00Z" },
    ]);
    expect(m.get("r1")).toEqual({ status: "fixed", note: "patched", at: "2026-11-23T02:00:00Z" });
    expect(m.get("r2")).toBeUndefined();
  });
});
