import { describe, it, expect } from "vitest";
import { resolveCoachingMode } from "../resolveCoachingMode";

/**
 * resolveCoachingMode maps a coaching_sessions.session_kind (migration 0237) to a CoachingMode. Total +
 * safe-defaulting: any unknown/null/legacy value → 'sales' (a mis-set or pre-0237 row is coached as sales,
 * never crashes, never fires a meeting brain on an unclassified session).
 */
describe("resolveCoachingMode", () => {
  it("maps the known kinds 1:1", () => {
    expect(resolveCoachingMode("sales")).toBe("sales");
    expect(resolveCoachingMode("meeting")).toBe("meeting");
    expect(resolveCoachingMode("huddle")).toBe("huddle");
  });

  it("safe-defaults null / undefined / legacy / unknown to sales", () => {
    expect(resolveCoachingMode(null)).toBe("sales");
    expect(resolveCoachingMode(undefined)).toBe("sales");
    expect(resolveCoachingMode("")).toBe("sales");
    expect(resolveCoachingMode("standup")).toBe("sales");
    expect(resolveCoachingMode("MEETING")).toBe("sales"); // case-sensitive; the DB stores lowercase
  });
});
