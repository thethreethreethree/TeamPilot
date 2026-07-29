import { describe, it, expect } from "vitest";
import { deferredColumnsToDrop } from "../deferredColumns";

const DEFERRABLE = ["business_type", "ai_assistance_guidance"] as const;
const missing = (col: string) => ({ code: "42703", message: `column "${col}" does not exist` });

describe("deferredColumnsToDrop (A34 multi-field upsert)", () => {
  it("returns [] when no deferrable column is the cause (error stays loud)", () => {
    // A different column missing → not our concern, caller must fail loudly.
    expect(deferredColumnsToDrop(DEFERRABLE, { business_type: "x", ai_assistance_guidance: "y" }, missing("some_other_col"))).toEqual([]);
    // A non-missing-column error (e.g. a constraint violation) → [].
    expect(deferredColumnsToDrop(DEFERRABLE, { ai_assistance_guidance: "y" }, { code: "23505", message: "duplicate key" })).toEqual([]);
  });

  it("drops ONLY the later column when the later migration is the one unapplied", () => {
    // 0188 applied, 0202 not: the error names ai_assistance_guidance → drop it, keep business_type.
    expect(
      deferredColumnsToDrop(DEFERRABLE, { business_type: "x", ai_assistance_guidance: "y" }, missing("ai_assistance_guidance"))
    ).toEqual(["ai_assistance_guidance"]);
  });

  it("drops the earlier column AND every later one when the earlier migration is unapplied", () => {
    // 0188 not applied ⇒ 0202 also not applied: dropping only business_type would fail again.
    expect(
      deferredColumnsToDrop(DEFERRABLE, { business_type: "x", ai_assistance_guidance: "y" }, missing("business_type"))
    ).toEqual(["business_type", "ai_assistance_guidance"]);
  });

  it("only drops columns that are actually in the patch", () => {
    // business_type missing but not in the patch (a guidance-only save) → drop just the guidance column.
    expect(deferredColumnsToDrop(DEFERRABLE, { ai_assistance_guidance: "y" }, missing("business_type"))).toEqual([]);
    expect(deferredColumnsToDrop(DEFERRABLE, { ai_assistance_guidance: "y" }, missing("ai_assistance_guidance"))).toEqual(["ai_assistance_guidance"]);
    expect(deferredColumnsToDrop(DEFERRABLE, { business_type: "x" }, missing("business_type"))).toEqual(["business_type"]);
  });
});
