import { describe, it, expect } from "vitest";
import { cleanLink, courseProgress, currentSteps, currentVersion, parseSteps, MAX_STEPS } from "../courses";

/** F17.1 (2026-11-26): courses are versions of ordered lessons; progress is derived from the current version. */
const row = (version: number, position: number, uid: string, title = uid) => ({ version, position, step_uid: uid, title, body: "text" });
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("training courses", () => {
  it("the current course is its highest version, in order", () => {
    const rows = [row(1, 1, "a"), row(1, 2, "b"), row(2, 2, "a", "A again"), row(2, 1, "c")];
    expect(currentSteps(rows).map((s) => [s.uid, s.title])).toEqual([["c", "c"], ["a", "A again"]]);
    expect(currentVersion(rows)).toBe(2);
    expect(currentSteps([])).toEqual([]);
  });
  it("progress counts current lessons only; done beats overdue; overdue only when not done", () => {
    const steps = [{ uid: "a", title: "", body: "", kind: "lesson" as const, scenarioId: null }, { uid: "c", title: "", body: "", kind: "lesson" as const, scenarioId: null }];
    const past = "2026-01-01T00:00:00Z";
    const future = "2999-01-01T00:00:00Z";
    expect(courseProgress({ steps, doneUids: ["b"], dueAt: future })).toEqual({ done: 0, total: 2, state: "not_started" }); // "b" was removed
    expect(courseProgress({ steps, doneUids: ["a"], dueAt: future })).toEqual({ done: 1, total: 2, state: "in_progress" });
    expect(courseProgress({ steps, doneUids: ["a"], dueAt: past }).state).toBe("overdue");
    expect(courseProgress({ steps, doneUids: ["a", "c"], dueAt: past }).state).toBe("done");
  });
  it("lessons are checked; known uids are kept, new or duplicated ones get a fresh uid", () => {
    let n = 100;
    const fresh = () => U(n++);
    expect(parseSteps([], fresh)).toEqual({ ok: false, error: "Add at least one lesson." });
    expect(parseSteps(Array.from({ length: MAX_STEPS + 1 }, () => ({ title: "t", body: "b" })), fresh).ok).toBe(false);
    expect(parseSteps([{ title: " ", body: "b" }], fresh)).toEqual({ ok: false, error: "Step 1 needs a title of up to 120 characters." });
    const r = parseSteps([{ uid: U(1), title: " Open ", body: " Ask first " }, { uid: U(1), title: "Copy", body: "b" }, { uid: "nope", title: "New", body: "b" }], fresh);
    expect(r.ok && r.steps.map((s) => s.uid)).toEqual([U(1), U(100), U(101)]);
    expect(r.ok && r.steps[0]).toEqual({ uid: U(1), title: "Open", body: "Ask first", kind: "lesson", scenarioId: null, libraryItemId: null, linkUrl: null });
  });
  it("a practice step needs a scenario; its note is optional (0357)", () => {
    let n = 200;
    const fresh = () => U(n++);
    expect(parseSteps([{ kind: "practice", title: "Try it", body: "" }], fresh)).toEqual({ ok: false, error: "Step 1 needs a practice scenario." });
    const r = parseSteps([{ kind: "practice", title: "Try it", body: "", scenarioId: U(7) }], fresh);
    expect(r.ok && r.steps[0]).toMatchObject({ kind: "practice", scenarioId: U(7), body: "" });
    expect(currentSteps([{ version: 1, position: 1, step_uid: "p", title: "Try", body: "", kind: "practice", scenario_id: "s1" }])[0]).toMatchObject({ kind: "practice", scenarioId: "s1" });
  });
  it("a lesson may carry an https link and a library item; a practice carries neither (0359)", () => {
    expect(cleanLink("https://www.youtube.com/watch?v=x")).toBe("https://www.youtube.com/watch?v=x");
    expect(cleanLink("http://example.com")).toBe(false);
    expect(cleanLink("javascript:alert(1)")).toBe(false);
    expect(cleanLink("https://a b")).toBe(false);
    expect(cleanLink("")).toBeNull();
    let n = 300;
    const fresh = () => U(n++);
    expect(parseSteps([{ title: "Watch", body: "b", linkUrl: "ftp://x" }], fresh)).toEqual({ ok: false, error: "Lesson 1's link must be a full https:// address." });
    const r = parseSteps([{ title: "Watch", body: "b", linkUrl: "https://loom.com/share/1", libraryItemId: U(9) }, { kind: "practice", title: "Try", scenarioId: U(8), linkUrl: "https://x.com", libraryItemId: U(9) }], fresh);
    expect(r.ok && r.steps.map((s) => [s.linkUrl, s.libraryItemId])).toEqual([["https://loom.com/share/1", U(9)], [null, null]]);
  });
});
