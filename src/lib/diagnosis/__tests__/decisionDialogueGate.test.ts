import { describe, it, expect } from "vitest";
import {
  hasSituation,
  hasUserDiagnosisAndProposal,
  readyForSystemResponse,
} from "../decisionDialogueGate";

/**
 * Locks the chat-thread §3.3 "guide-don't-overtake" gate: the System may not generate
 * its response until the user has supplied a non-empty situation, diagnosis, AND proposal.
 * This is the REAL enforcement of "user diagnoses before the System asserts" for dialogues
 * that originate in a chat thread (the `decision_dialogues` NOT NULL is satisfied by the
 * decide fn's coalesce-to-'' — see decisionDialogueGate.ts + the 2026-07-23 ground-up audit).
 * If any of these flip, the System could assert its suggestion before the user has diagnosed.
 */

const FULL = {
  situation: "Sprint is slipping",
  userDiagnosis: "Scope crept mid-sprint",
  userProposal: "Freeze scope, re-plan Friday",
};

describe("readyForSystemResponse — the full §3.3 pre-condition", () => {
  it("is true only when situation, diagnosis, and proposal are all supplied", () => {
    expect(readyForSystemResponse(FULL)).toBe(true);
  });

  it("is false when the situation is missing (user must frame the problem first)", () => {
    expect(readyForSystemResponse({ ...FULL, situation: "" })).toBe(false);
    expect(readyForSystemResponse({ ...FULL, situation: null })).toBe(false);
    expect(readyForSystemResponse({ ...FULL, situation: undefined })).toBe(false);
  });

  it("is false when the user's diagnosis is missing (the System cannot pre-empt the user's read)", () => {
    expect(readyForSystemResponse({ ...FULL, userDiagnosis: "" })).toBe(false);
    expect(readyForSystemResponse({ ...FULL, userDiagnosis: null })).toBe(false);
  });

  it("is false when the user's proposal is missing (the user must own a proposal first)", () => {
    expect(readyForSystemResponse({ ...FULL, userProposal: "" })).toBe(false);
    expect(readyForSystemResponse({ ...FULL, userProposal: null })).toBe(false);
  });

  it("treats whitespace-only input as NOT supplied (a space is not a diagnosis)", () => {
    expect(readyForSystemResponse({ ...FULL, userDiagnosis: "   " })).toBe(false);
    expect(readyForSystemResponse({ ...FULL, userProposal: "\n\t " })).toBe(false);
    expect(readyForSystemResponse({ ...FULL, situation: "  " })).toBe(false);
  });

  it("is false for a wholly empty dialogue", () => {
    expect(readyForSystemResponse({})).toBe(false);
  });
});

describe("hasSituation — gates situation → elicit", () => {
  it("requires a non-empty, non-whitespace situation", () => {
    expect(hasSituation({ situation: "We keep missing standup" })).toBe(true);
    expect(hasSituation({ situation: "" })).toBe(false);
    expect(hasSituation({ situation: "   " })).toBe(false);
    expect(hasSituation({ situation: null })).toBe(false);
    expect(hasSituation({})).toBe(false);
  });
});

describe("hasUserDiagnosisAndProposal — gates elicit → respond", () => {
  it("requires BOTH diagnosis and proposal (user owns their read before the System responds)", () => {
    expect(
      hasUserDiagnosisAndProposal({ userDiagnosis: "d", userProposal: "p" })
    ).toBe(true);
  });
  it("is false if only one of the two is present", () => {
    expect(hasUserDiagnosisAndProposal({ userDiagnosis: "d" })).toBe(false);
    expect(hasUserDiagnosisAndProposal({ userProposal: "p" })).toBe(false);
  });
  it("is false when either is whitespace-only", () => {
    expect(
      hasUserDiagnosisAndProposal({ userDiagnosis: "d", userProposal: "  " })
    ).toBe(false);
    expect(
      hasUserDiagnosisAndProposal({ userDiagnosis: " ", userProposal: "p" })
    ).toBe(false);
  });
});
