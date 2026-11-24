import { describe, it, expect } from "vitest";
import { currentlyMuted, isMutableType, MUTABLE_NOTIFICATION_TYPES } from "../mutes";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("notification mutes (0334)", () => {
  it("the latest change per type wins", () => {
    expect(currentlyMuted([
      { id: 3, type: "call_ready", muted: false },
      { id: 1, type: "call_ready", muted: true },
      { id: 2, type: "strong_session", muted: true },
    ])).toEqual(["strong_session"]);
  });
  it("action notices are never mutable", () => {
    for (const t of ["score_disputed", "feedback_requested", "comment_mention", "pitch_score_corrected", "dispute_answered"]) expect(isMutableType(t)).toBe(false);
  });
  it("the code's list is exactly the database CHECK's list", () => {
    const sql = readFileSync(resolve(__dirname, "../../../../supabase/migrations/0334_notification_mutes.sql"), "utf8");
    const inCheck = [...sql.match(/check \(type in \(([^)]*)\)\)/)![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(inCheck).toEqual([...MUTABLE_NOTIFICATION_TYPES]);
  });
});
