import { describe, it, expect } from "vitest";
import { buildUserMessage } from "../prompt";
import type { CoachContextPayload, CoachContextType } from "../types";

/**
 * buildUserMessage assembles the surface-specific context the Coach reasons over. Two things matter most:
 *   - the right context reaches the model per surface (e.g. support_reply's PRODUCT CONTEXT ground-truth, whose
 *     absence is the dominant support failure — fabricated specifics), and
 *   - surfaces DON'T bleed: a section gated by `contextType === X` must not appear for a different context, even
 *     if its field happens to be present in the payload.
 */

const build = (contextType: CoachContextType, payload: Partial<CoachContextPayload>, draft = "my draft") =>
  buildUserMessage({ draft, contextType, contextPayload: payload as CoachContextPayload });

describe("buildUserMessage", () => {
  it("always leads with the draft", () => {
    expect(build("chat_message", {})).toMatch(/^DRAFT TO ANALYZE:\nmy draft/);
  });

  it("support_reply surfaces customer name, last message, and the PRODUCT CONTEXT ground-truth", () => {
    const out = build("support_reply", {
      supportCustomerName: "Dana",
      supportCustomerLastMessage: { author: "Dana", body: "still no refund" },
      supportProductContext: "Refunds take 5-7 business days.",
    });
    expect(out).toContain("CUSTOMER NAME:\nDana");
    expect(out).toContain("still no refund");
    expect(out).toContain("PRODUCT CONTEXT");
    expect(out).toContain("Refunds take 5-7 business days.");
  });

  it("does NOT bleed support fields into a non-support surface (contextType gates the section)", () => {
    const out = build("task_field", {
      taskTitle: "Ship the thing",
      // present in the payload but must be ignored because contextType !== support_reply
      supportCustomerName: "Dana",
      supportProductContext: "secret",
    });
    expect(out).toContain("TASK TITLE:\nShip the thing");
    expect(out).not.toContain("CUSTOMER NAME");
    expect(out).not.toContain("secret");
  });

  it("task_field includes title and description", () => {
    const out = build("task_field", { taskTitle: "T", taskDescription: "D" });
    expect(out).toContain("TASK TITLE:\nT");
    expect(out).toContain("TASK DESCRIPTION:\nD");
  });

  it("decision_dialogue includes the situation and drops empty prior-phase values", () => {
    const out = build("decision_dialogue", {
      decisionSituation: "pricing change",
      decisionPriorPhases: { framing: "raise 10%", options: "", risks: "churn" } as never,
    });
    expect(out).toContain("DECISION SITUATION:\npricing change");
    expect(out).toContain("framing: raise 10%");
    expect(out).toContain("risks: churn");
    expect(out).not.toContain("options:"); // empty value filtered out
  });

  it("chat_reply includes the parent message being replied to", () => {
    const out = build("chat_reply", { parentMessage: { author: "Sam", body: "what about latency?" } });
    expect(out).toContain("REPLYING TO Sam:");
    expect(out).toContain("what about latency?");
  });

  it("caps the recent thread at the last 10 messages", () => {
    const thread = Array.from({ length: 15 }, (_, i) => ({ author: "u", body: `msg${i}` }));
    const out = build("chat_message", { recentThread: thread } as Partial<CoachContextPayload>);
    expect(out).toContain("msg14"); // newest kept
    expect(out).not.toContain("msg4"); // 5th-from-start dropped (only last 10)
    expect(out).toContain("msg5"); // boundary: 10 from the end
  });
});
