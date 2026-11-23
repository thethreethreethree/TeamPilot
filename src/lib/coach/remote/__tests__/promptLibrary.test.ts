import { describe, it, expect } from "vitest";
import { PROMPT_LIBRARY, promptGroups } from "../promptLibrary";

describe("prompt library", () => {
  it("every prompt fits the box it fills (pipeline route: 3-1000, call route: 3-2000)", () => {
    for (const p of PROMPT_LIBRARY.pipeline) expect(p.text.length).toBeLessThanOrEqual(1000);
    for (const p of PROMPT_LIBRARY.call) expect(p.text.length).toBeLessThanOrEqual(2000);
    for (const p of [...PROMPT_LIBRARY.pipeline, ...PROMPT_LIBRARY.call]) expect(p.text.length).toBeGreaterThanOrEqual(3);
  });
  it("ids are unique across both boxes", () => {
    const ids = [...PROMPT_LIBRARY.pipeline, ...PROMPT_LIBRARY.call].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("groups keep their first-seen order and hold every prompt", () => {
    const g = promptGroups("call");
    expect(g.map((x) => x.group)).toEqual(["Coach me", "Read the buyer", "After the call"]);
    expect(g.flatMap((x) => x.prompts).length).toBe(PROMPT_LIBRARY.call.length);
  });
  it("call prompts don't promise data the call box doesn't have (no CRM, email or other deals)", () => {
    for (const p of PROMPT_LIBRARY.call) expect(p.text).not.toMatch(/\b(CRM|email thread|other deals|all deals)\b/i);
  });
});
