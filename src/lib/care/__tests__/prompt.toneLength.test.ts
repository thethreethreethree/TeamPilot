import { describe, it, expect } from "vitest";
import { buildCareSystemPrompt } from "@/lib/care/prompt";

/**
 * Regression guard for audit F2 (2026-07-22): care_tenant_config.aiTone / aiResponseLength were
 * loaded from the DB but never passed to buildCareSystemPrompt, so a tenant's tone/length choice did
 * nothing. These tests assert the settings actually reach Jeff's system prompt and change it.
 */
describe("buildCareSystemPrompt — tone & length directive (F2)", () => {
  it("always emits a TONE & LENGTH section (the settings are wired, not dropped)", () => {
    const p = buildCareSystemPrompt({});
    expect(p).toContain("TONE & LENGTH");
  });

  it("defaults to warm + medium when unset (prior baked-in behaviour preserved)", () => {
    const p = buildCareSystemPrompt({});
    expect(p).toContain("Tone: warm and empathetic");
    expect(p).toContain("most replies are 1-4 sentences");
  });

  it("honours aiTone=formal", () => {
    const p = buildCareSystemPrompt({ aiTone: "formal" });
    expect(p).toContain("Tone: professional and precise");
    expect(p).not.toContain("Tone: warm and empathetic");
  });

  it("honours aiResponseLength=short", () => {
    const p = buildCareSystemPrompt({ aiResponseLength: "short" });
    expect(p).toContain("keep replies to 1-2 sentences");
    expect(p).not.toContain("most replies are 1-4 sentences");
  });

  it("combines a non-default tone + length (formal / short really changes the prompt)", () => {
    const p = buildCareSystemPrompt({ aiTone: "formal", aiResponseLength: "short" });
    expect(p).toContain("Tone: professional and precise");
    expect(p).toContain("keep replies to 1-2 sentences");
  });

  it("keeps voice mode's 1-sentence cap after the tone/length directive", () => {
    const p = buildCareSystemPrompt({ medium: "voice", aiResponseLength: "long" });
    const toneIdx = p.indexOf("TONE & LENGTH");
    // The voice addendum is appended AFTER the tone/length block, so its stricter cap wins.
    expect(toneIdx).toBeGreaterThan(-1);
    expect(p.length).toBeGreaterThan(toneIdx);
  });
});
