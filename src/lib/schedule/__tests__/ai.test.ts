import { describe, it, expect, vi } from "vitest";
import { parseLlmOutput, parseRequest, buildTimeOffEvent, generateProposal, parseMappingOutput, proposeImportMapping } from "../ai";
import type { LlmResult, LlmCallArgs } from "@/lib/llm/types";

/**
 * Phase 4 LLM layer (advisory). The LLM is INJECTED so these are deterministic. What they lock: a malformed
 * parse fails LOUD (never a guessed event), the parsed draft is schema-validated before it can be written,
 * the request prompt carries the injection fence, and the proposal voice strips em/en dashes (founder voice).
 */

const U = "11111111-1111-4111-8111-111111111111";
const llmReturning = (text: string) => vi.fn(async (_args: LlmCallArgs): Promise<LlmResult> => ({ text } as LlmResult));

describe("parseLlmOutput (deterministic, fail-loud)", () => {
  it("parses a well-formed time_off reply", () => {
    const r = parseLlmOutput('{"kind":"time_off","type":"vacation","start":"2026-08-22","end":"2026-08-22","interpretation":"Time off Fri Aug 22, vacation."}');
    expect(r.kind).toBe("time_off");
    expect(r.draft).toEqual({ type: "vacation", start: "2026-08-22", end: "2026-08-22" });
  });
  it("an unclear reply stays unclear", () => {
    expect(parseLlmOutput('{"kind":"unclear","interpretation":"No date given."}').kind).toBe("unclear");
  });
  it("MALFORMED json fails loud → unclear, never a guessed event", () => {
    expect(parseLlmOutput("not json at all").kind).toBe("unclear");
    expect(parseLlmOutput('{"kind":"time_off"}').kind).toBe("unclear"); // missing fields
  });
});

describe("parseRequest (injection fence + injected llm)", () => {
  it("routes the reply through parseLlmOutput", async () => {
    const llm = llmReturning('{"kind":"time_off","type":"sick","start":"2026-08-21","end":"2026-08-21","interpretation":"Sick day Aug 21."}');
    const r = await parseRequest("I'm out sick tomorrow", { today: "2026-08-20", llm });
    expect(r.kind).toBe("time_off");
    // the untrusted text is fenced (prompt-injection posture) + expectJson set
    const args = llm.mock.calls[0]?.[0];
    expect(args?.systemPrompt).toMatch(/CONVERSATION|data, not|instructions/i);
    expect(args?.expectJson).toBe(true);
  });
});

describe("buildTimeOffEvent (schema-validated before write)", () => {
  it("builds a valid TIMEOFF_REQUESTED from a confirmed draft", () => {
    const r = buildTimeOffEvent({ type: "vacation", start: "2026-08-22", end: "2026-08-22" }, U, U);
    expect(r.ok).toBe(true);
  });
  it("rejects an out-of-vocabulary type (the parse cannot inject a bad event)", () => {
    const r = buildTimeOffEvent({ type: "holiday", start: "2026-08-22", end: "2026-08-22" }, U, U);
    expect(r.ok).toBe(false);
  });
});

describe("generateProposal (recommend + why, warm + plain, no dashes)", () => {
  it("strips em/en dashes from the proposal (founder voice)", async () => {
    const llm = llmReturning("I'd give it to Beth — she's free this week and has the fewest hours.");
    const out = await generateProposal({ impactSummary: "Fri AM 1 short.", candidates: [{ employeeId: "b", name: "Beth", addsHours: 8, currentHours: 0 }], opts: { llm } });
    expect(out).not.toMatch(/[—–]/);
    expect(out.toLowerCase()).toContain("beth");
  });
  it("passes the top candidate as the recommendation and never fabricates people", async () => {
    const llm = llmReturning("Recommend Ana.");
    await generateProposal({ impactSummary: "x", candidates: [{ employeeId: "a", name: "Ana", addsHours: 8, currentHours: 5 }], opts: { llm } });
    const payload = JSON.parse(String(llm.mock.calls[0]?.[0]?.messages?.[0]?.content ?? "{}"));
    expect(payload.recommend?.name).toBe("Ana");
  });
});

describe("parseMappingOutput + proposeImportMapping (propose-then-confirm)", () => {
  it("parses a proposed mapping: dates + code times + off, dropping invalid times", () => {
    const r = parseMappingOutput('{"headerDates":["2026-08-16","2026-08-17"],"codeMap":{"6-3":{"start":"06:00","end":"15:00"},"OFF":"off","BAD":{"start":"x","end":"y"}},"notes":"unsure about GY"}');
    expect(r.headerDates).toEqual(["2026-08-16", "2026-08-17"]);
    expect(r.codeMap["6-3"]).toEqual({ start: "06:00", end: "15:00" });
    expect(r.codeMap["OFF"]).toBe("off");
    expect(r.codeMap["BAD"]).toBeUndefined(); // invalid time dropped, not guessed
    expect(r.notes).toMatch(/unsure/i);
  });

  it("a malformed reply → empty proposal (human maps by hand)", () => {
    const r = parseMappingOutput("not json");
    expect(r.headerDates).toEqual([]);
    expect(Object.keys(r.codeMap)).toHaveLength(0);
  });

  it("proposeImportMapping fences the file content + routes through the parser", async () => {
    const llm = llmReturning('{"headerDates":["2026-08-16"],"codeMap":{"OFF":"off"},"notes":""}');
    const r = await proposeImportMapping({ headerCells: ["AUG 16"], codes: ["OFF", "GY"], contextHint: "AUGUST 2026", opts: { llm } });
    expect(r.codeMap["OFF"]).toBe("off");
    expect(String(llm.mock.calls[0]?.[0]?.systemPrompt)).toMatch(/CONVERSATION|data, not|instructions/i);
  });
});
