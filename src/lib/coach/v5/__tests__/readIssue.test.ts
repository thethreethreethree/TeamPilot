import { describe, it, expect } from "vitest";
import { readIssueFor } from "../readIssue";

/**
 * readIssueFor — mirrored in the mobile app as `readIssueFor` in `src/lib/capture-issue.ts`.
 *
 * The two repositories cannot import from each other: the app reads `coaching_sessions` straight from
 * Supabase and never calls this route. So both pin the SAME six shapes and the SAME precedence, and a
 * change to one that the other does not follow shows up as a failing test rather than as the dashboard
 * and the phone quietly disagreeing about the same call.
 */
describe("readIssueFor — the coach failed, or the call had little in it", () => {
  it("surfaces the three shapes that mean the COACH failed", () => {
    expect(readIssueFor(false, "no_signal", "llm_empty")).toBe("unfinished");
    expect(readIssueFor(false, "no_signal", "unparsable")).toBe("unfinished");
    expect(readIssueFor(false, "no_signal", "threw")).toBe("unfinished");
  });

  it("stays silent when the coach READ the call and found little — no retry for nothing to give", () => {
    expect(readIssueFor(false, "no_signal", "no_strengths")).toBeNull();
  });

  it("stays silent on a policy decline — nothing failed", () => {
    expect(readIssueFor(false, "no_signal", "suppressed")).toBeNull();
  });

  it("stays silent on an OLDER decline that carries no shape — unknown is not a diagnosis", () => {
    expect(readIssueFor(false, "no_signal", null)).toBeNull();
    expect(readIssueFor(false, "no_signal", undefined)).toBeNull();
  });

  it("keeps one-sided winning over any shape — it names the capture problem, which is fixable", () => {
    expect(readIssueFor(false, "no_agent_turns", "llm_empty")).toBe("one-sided");
    expect(readIssueFor(false, "no_agent_turns", null)).toBe("one-sided");
  });

  it("says nothing at all once a read exists, whatever an earlier attempt recorded", () => {
    expect(readIssueFor(true, "no_signal", "llm_empty")).toBeNull();
    expect(readIssueFor(true, "no_agent_turns", "threw")).toBeNull();
  });

  it("ignores a shape it does not recognise rather than inventing a verdict for it", () => {
    expect(readIssueFor(false, "no_signal", "something_new")).toBeNull();
  });
});
