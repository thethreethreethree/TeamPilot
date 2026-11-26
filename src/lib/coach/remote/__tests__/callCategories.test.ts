import { describe, it, expect } from "vitest";
import { checkName, currentCategories, MAX_CATEGORIES } from "../callCategories";

/** Call categories (F10.10, 0367): the latest pick is the call's category; names are checked. */
describe("call categories", () => {
  it("the latest pick per call wins; a cleared pick is null", () => {
    const m = currentCategories([
      { id: 1, session_id: "s1", category_id: "a" },
      { id: 3, session_id: "s1", category_id: "b" },
      { id: 2, session_id: "s2", category_id: "a" },
      { id: 4, session_id: "s2", category_id: null },
    ]);
    expect(m.get("s1")).toBe("b");
    expect(m.get("s2")).toBeNull();
    expect(m.has("s3")).toBe(false);
  });
  it("names: 1–40 characters, no duplicate in any case, at most 20", () => {
    expect(checkName("  Discovery  call ", [])).toEqual({ ok: true, name: "Discovery call" });
    expect(checkName("", []).ok).toBe(false);
    expect(checkName("demo", ["Demo"])).toEqual({ ok: false, error: "There is already a category called demo." });
    expect(checkName("x", Array.from({ length: MAX_CATEGORIES }, (_, i) => `c${i}`)).ok).toBe(false);
  });
});
