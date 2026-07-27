import { describe, it, expect } from "vitest";
import { toolRequest } from "../CareRadialHome";

// The mobile radial ring tools map to real C.A.R.E routes. This locks the mapping so a future edit can't
// (a) point a tool at the wrong route, or (b) reintroduce the empty-draft stub that made "Ask Coach" always
// 400 (ask-coach requires draft.min(1) — the mobile stub had sent draft:"", never runtime-exercised).
const CONV = "conv-123";

describe("toolRequest — mobile radial tool → route mapping", () => {
  it("summarize / dissect / co-pilot hit their conversation routes with a (bodyless) POST", () => {
    expect(toolRequest("summarize", CONV).url).toBe(`/api/care/agent/conversations/${CONV}/summarize`);
    expect(toolRequest("dissect", CONV).url).toBe(`/api/care/agent/conversations/${CONV}/dissect`);
    expect(toolRequest("copilot", CONV).url).toBe(`/api/care/agent/conversations/${CONV}/co-pilot`);
  });

  // NOTE: "task" is NOT a toolRequest case — handleTool special-cases it (redirects to the conversation page,
  // since spawn needs full context a one-shot POST can't give). toolRequest's type excludes "task", so there's
  // deliberately no assertion here; an earlier version of this test wrongly asserted a dead `/api/tasks/spawn`
  // mapping that was never reached.

  it("coach hits ask-coach with a NON-EMPTY draft (the fix — empty draft 400s on draft.min(1))", () => {
    const { url, body } = toolRequest("coach", CONV);
    expect(url).toBe(`/api/care/agent/conversations/${CONV}/ask-coach`);
    const draft = (body as { draft?: string; mode?: string }).draft ?? "";
    expect(draft.trim().length).toBeGreaterThan(0); // must satisfy the route's z.string().min(1)
    expect((body as { mode?: string }).mode).toBe("ask");
  });
});
