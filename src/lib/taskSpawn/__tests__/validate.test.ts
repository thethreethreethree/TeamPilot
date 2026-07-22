import { describe, it, expect } from "vitest";
import { validateTaskDraft } from "../validate";

/**
 * Shared spawned-task-draft validator — gates what BOTH the in-app /api/tasks/spawn and the extension spawn
 * endpoint accept from the model. Pins the bounds (title ≤400, description ≤8000, 1–20 steps ≤800) and the
 * trimming, so a malformed/over-long draft fails CLOSED (→ null → the route 502s) instead of reaching a task row.
 */

const ok = { title: "Fix push", description: "Push blocked past 400 days", steps: ["Check window", "Re-enable"] };

describe("validateTaskDraft", () => {
  it("accepts a valid draft and trims title/description/steps", () => {
    const r = validateTaskDraft({ title: "  Fix push  ", description: "  desc  ", steps: ["  a  ", "b"] });
    expect(r).toEqual({ title: "Fix push", description: "desc", steps: ["a", "b"] });
  });

  it("rejects non-object / null", () => {
    expect(validateTaskDraft(null)).toBeNull();
    expect(validateTaskDraft("x")).toBeNull();
  });

  it("rejects an empty or over-long title (>400)", () => {
    expect(validateTaskDraft({ ...ok, title: "   " })).toBeNull();
    expect(validateTaskDraft({ ...ok, title: "x".repeat(401) })).toBeNull();
  });

  it("rejects an empty or over-long description (>8000)", () => {
    expect(validateTaskDraft({ ...ok, description: "" })).toBeNull();
    expect(validateTaskDraft({ ...ok, description: "x".repeat(8001) })).toBeNull();
  });

  it("rejects zero steps and >20 steps", () => {
    expect(validateTaskDraft({ ...ok, steps: [] })).toBeNull();
    expect(validateTaskDraft({ ...ok, steps: Array.from({ length: 21 }, (_, i) => `s${i}`) })).toBeNull();
  });

  it("rejects a non-string, empty, or over-long (>800) step", () => {
    expect(validateTaskDraft({ ...ok, steps: ["good", 42] })).toBeNull();
    expect(validateTaskDraft({ ...ok, steps: ["good", "   "] })).toBeNull();
    expect(validateTaskDraft({ ...ok, steps: ["good", "x".repeat(801)] })).toBeNull();
  });

  it("accepts exactly 20 steps (boundary)", () => {
    const r = validateTaskDraft({ ...ok, steps: Array.from({ length: 20 }, (_, i) => `s${i}`) });
    expect(r!.steps).toHaveLength(20);
  });
});
