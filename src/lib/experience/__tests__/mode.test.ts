import { describe, it, expect } from "vitest";
import { makeSupabaseClient } from "../../data/__tests__/_supabaseMock";
import {
  modeDirective,
  getExperienceMode,
  isExperienceMode,
  shapeSystemPrompt,
  DEFAULT_EXPERIENCE_MODE,
} from "../mode";

describe("experience mode — the per-user complexity dial (0110)", () => {
  describe("modeDirective (the AI-content shaping, A16 single-source)", () => {
    it("Expert returns an EMPTY directive — today's full behavior is the baseline", () => {
      expect(modeDirective("expert")).toBe("");
    });

    it("Standard instructs: answer-first, brief, plain — the founder's 'just the answer' choice", () => {
      const d = modeDirective("standard");
      expect(d).toContain("STANDARD");
      expect(d.toLowerCase()).toContain("next action");
      expect(d.toLowerCase()).toContain("brief");
      expect(d.toLowerCase()).toContain("plain language");
    });

    it("Standard keeps the §3.4 honesty guardrail — simplify presentation, not correctness", () => {
      const d = modeDirective("standard").toLowerCase();
      // Must explicitly forbid dropping caveats / overstating confidence.
      expect(d).toContain("presentation only");
      expect(d).toMatch(/never omit a material caveat|simpler, not less honest/);
    });
  });

  describe("shapeSystemPrompt (the central llmCall/llmStream injection)", () => {
    const BASE = "You are a helpful coach. Do X.";

    it("leaves the prompt UNCHANGED for expert (today's behavior)", () => {
      expect(shapeSystemPrompt(BASE, "expert")).toBe(BASE);
    });

    it("leaves the prompt UNCHANGED when mode is undefined (a surface that didn't thread it)", () => {
      expect(shapeSystemPrompt(BASE, undefined)).toBe(BASE);
    });

    it("APPENDS the Standard directive for standard (keeps the base prompt intact, adds shaping)", () => {
      const out = shapeSystemPrompt(BASE, "standard");
      expect(out.startsWith(BASE)).toBe(true); // never replaces the feature's own instructions
      expect(out.length).toBeGreaterThan(BASE.length);
      expect(out).toContain("STANDARD");
    });
  });

  describe("isExperienceMode", () => {
    it("accepts the two valid modes, rejects anything else", () => {
      expect(isExperienceMode("standard")).toBe(true);
      expect(isExperienceMode("expert")).toBe(true);
      expect(isExperienceMode("Standard")).toBe(false);
      expect(isExperienceMode(null)).toBe(false);
      expect(isExperienceMode(undefined)).toBe(false);
      expect(isExperienceMode("")).toBe(false);
    });
  });

  describe("getExperienceMode (server read, fails safe)", () => {
    it("returns 'expert' when the profile column says expert", async () => {
      const calls: Array<[string, unknown[]]> = [];
      const sb = makeSupabaseClient(
        { profiles: { data: { experience_mode: "expert" }, error: null } },
        calls
      );
      expect(await getExperienceMode(sb as never, "u1")).toBe("expert");
    });

    it("returns 'standard' when the column says standard", async () => {
      const calls: Array<[string, unknown[]]> = [];
      const sb = makeSupabaseClient(
        { profiles: { data: { experience_mode: "standard" }, error: null } },
        calls
      );
      expect(await getExperienceMode(sb as never, "u1")).toBe("standard");
    });

    it("fails safe to the default (standard) on a DB error — never over-serve complexity", async () => {
      const calls: Array<[string, unknown[]]> = [];
      const sb = makeSupabaseClient(
        { profiles: { data: null, error: { message: "boom" } } },
        calls
      );
      expect(await getExperienceMode(sb as never, "u1")).toBe(
        DEFAULT_EXPERIENCE_MODE
      );
      expect(DEFAULT_EXPERIENCE_MODE).toBe("standard");
    });

    it("fails safe to standard when the row is missing (unknown user)", async () => {
      const calls: Array<[string, unknown[]]> = [];
      const sb = makeSupabaseClient(
        { profiles: { data: null, error: null } },
        calls
      );
      expect(await getExperienceMode(sb as never, "u1")).toBe("standard");
    });
  });
});
