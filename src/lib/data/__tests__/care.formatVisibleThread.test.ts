import { describe, expect, it, vi } from "vitest";

/**
 * formatVisibleThreadForPrompt pins the single shared thread formatter that Summarize,
 * Dissect, and Dissect's Ask-Coach follow-up all feed to the LLM (A13 author-once). These
 * tests fix its contract so the three tools can never ground the model in a differently
 * shaped transcript: (1) each author_type maps to its exact role label, (2) internal notes
 * are excluded (agent scratch, not part of the conversation being read), (3) an empty or
 * all-internal thread is the empty string (the engines' honest-empty guard handles the rest).
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { formatVisibleThreadForPrompt } from "../care";
import type { SupportMessage } from "../care";

function msg(over: Partial<SupportMessage>): SupportMessage {
  return {
    id: "m",
    conversationId: "c",
    authorType: "customer",
    authorId: null,
    body: "",
    isInternalNote: false,
    createdAt: "2026-01-01T00:00:00Z",
    coachGrade: null,
    coachReasonInternal: null,
    coachGradedAt: null,
    coachCounts: null,
    coPilotReasoning: null,
    coPilotInvoked: false,
    kind: "message",
    mediaUrl: null,
    mediaType: null,
    ...over,
  };
}

describe("formatVisibleThreadForPrompt", () => {
  it("maps each author_type to its role label and joins with newlines", () => {
    const out = formatVisibleThreadForPrompt([
      msg({ authorType: "customer", body: "hi" }),
      msg({ authorType: "ai", body: "hello" }),
      msg({ authorType: "agent", body: "on it" }),
      msg({ authorType: "system", body: "connected" }),
    ]);
    expect(out).toBe("Customer: hi\nAI: hello\nAgent: on it\nSystem: connected");
  });

  it("excludes internal notes (agent scratch, not part of the conversation)", () => {
    const out = formatVisibleThreadForPrompt([
      msg({ authorType: "customer", body: "visible" }),
      msg({ authorType: "agent", body: "private note", isInternalNote: true }),
      msg({ authorType: "agent", body: "reply" }),
    ]);
    expect(out).toBe("Customer: visible\nAgent: reply");
  });

  it("returns empty string for an empty or all-internal thread", () => {
    expect(formatVisibleThreadForPrompt([])).toBe("");
    expect(
      formatVisibleThreadForPrompt([msg({ isInternalNote: true, body: "x" })])
    ).toBe("");
  });
});
