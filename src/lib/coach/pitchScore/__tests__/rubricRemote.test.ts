import { describe, it, expect } from "vitest";
import { BONUSES, ELEMENTS, ELEMENTS_BY_ID, BONUSES_BY_ID, SECTIONS } from "../rubric";
import { REMOTE_BONUSES, REMOTE_ELEMENTS, REMOTE_RUBRIC_VERSION } from "../rubricRemote";
import { DOOR_RUBRIC, REMOTE_RUBRIC, REMOTE_RUBRIC_APPROVED, rubricByVersion, rubricForChannel } from "../rubricRegistry";
import { buildPitchScoreSystemPrompt } from "../pitchScorePrompt";

/**
 * The phone & video rubric draft (D6, docs/rss/REMOTE-RUBRIC-DRAFT.md). Its promise to the founder: same sections and
 * weights as the door rubric, so scores stay comparable; and it scores nothing until approved.
 */
describe("phone & video rubric draft", () => {
  it("has the door rubric's sections and weights — every section sums to the same maximum, 100 in all", () => {
    for (const s of SECTIONS) {
      const remote = REMOTE_ELEMENTS.filter((e) => e.section === s.id).reduce((n, e) => n + e.points, 0);
      const door = ELEMENTS.filter((e) => e.section === s.id).reduce((n, e) => n + e.points, 0);
      expect(remote, s.id).toBe(s.maxPoints);
      expect(remote, s.id).toBe(door);
    }
  });

  it("bonuses are worth the same as the door's, one for one", () => {
    expect(REMOTE_BONUSES.map((b) => b.points)).toEqual(BONUSES.map((b) => b.points));
  });

  it("ids are unique, and a reused door id always carries the door's label (a lookup can't show the wrong words)", () => {
    expect(new Set(REMOTE_ELEMENTS.map((e) => e.id)).size).toBe(REMOTE_ELEMENTS.length);
    const doorById = new Map(ELEMENTS.map((e) => [e.id, e]));
    for (const e of REMOTE_ELEMENTS) if (doorById.has(e.id)) expect(e.label, e.id).toBe(doorById.get(e.id)!.label);
    const doorBonus = new Map(BONUSES.map((b) => [b.id, b]));
    for (const b of REMOTE_BONUSES) if (doorBonus.has(b.id)) expect(b.label, b.id).toBe(doorBonus.get(b.id)!.label);
  });

  it("label lookups find the remote-only items", () => {
    expect(ELEMENTS_BY_ID.get("close.enrollOnCall")?.label).toBe("Into enrollment, on the call");
    expect(BONUSES_BY_ID.get("bonus.decisionMakerJoins")?.label).toBe("Decision maker joins the call");
    expect(ELEMENTS_BY_ID.get("intro.trucks")?.label).toBe("Trucks / neighborhood notice"); // door items unchanged
  });

  it("is NOT used until approved: every call gets the door rubric today", () => {
    expect(REMOTE_RUBRIC_APPROVED).toBe(false);
    for (const c of ["phone", "video", "in_person", null]) expect(rubricForChannel(c)).toBe(DOOR_RUBRIC);
  });

  it("once approved, phone and video get it and door doesn't; stored scores read by their own version", () => {
    expect(rubricForChannel("phone", true)).toBe(REMOTE_RUBRIC);
    expect(rubricForChannel("video", true)).toBe(REMOTE_RUBRIC);
    expect(rubricForChannel("in_person", true)).toBe(DOOR_RUBRIC);
    expect(rubricByVersion(REMOTE_RUBRIC_VERSION)).toBe(REMOTE_RUBRIC);
    expect(rubricByVersion("attfiber-v1")).toBe(DOOR_RUBRIC);
  });

  it("the grading prompt for the remote rubric lists its own items and version", () => {
    const p = buildPitchScoreSystemPrompt(null, REMOTE_RUBRIC);
    expect(p).toContain("intro.permissionAgenda");
    expect(p).toContain("bonus.decisionMakerJoins");
    expect(p).not.toContain("intro.trucks");
    expect(p).toContain(REMOTE_RUBRIC_VERSION);
    expect(buildPitchScoreSystemPrompt(null)).toContain("intro.trucks"); // the door prompt is unchanged
  });
});
