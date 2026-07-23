import { describe, it, expect } from "vitest";
import {
  copilotModeInstruction,
  lastSpeakerFromAuthorType,
  type LastSpeaker,
} from "../copilotMode";

/**
 * Locks the Co-Pilot response-mode selector (founder request 2026-07-23). The load-bearing
 * behaviours: agent-spoke-last → FOLLOW-UP (never reply-to-self); customer-spoke-last → REPLY;
 * unknown → determine-then-default-to-REPLY (no regression). TT.md A18 — the mode is the defense,
 * so its wording is worth pinning against silent drift.
 */
describe("copilotModeInstruction", () => {
  const AGENT = "John";

  it("agent spoke last → FOLLOW-UP mode, explicitly forbids replying to own message", () => {
    const out = copilotModeInstruction("agent", AGENT);
    expect(out).toContain("FOLLOW-UP");
    expect(out).toMatch(/do not respond to your own message/i);
    expect(out).toContain(AGENT);
    // must NOT tell the model to reply to the last message
    expect(out).not.toMatch(/RESPONSE MODE — REPLY/);
  });

  it("customer spoke last → REPLY mode", () => {
    const out = copilotModeInstruction("customer", AGENT);
    expect(out).toContain("REPLY");
    expect(out).toMatch(/reply directly to what the customer said/i);
    expect(out).not.toContain("FOLLOW-UP");
  });

  it("unknown → determine first, but DEFAULT TO REPLY (no regression from today)", () => {
    const out = copilotModeInstruction("unknown", AGENT);
    expect(out).toMatch(/determine|work out who/i);
    // both branches described, and the safe default is reply
    expect(out).toMatch(/follow-up/i);
    expect(out).toMatch(/default to replying/i);
  });

  it("always weaves in the agent name (composition with the 2b anchor — A16)", () => {
    for (const s of ["agent", "customer", "unknown"] as LastSpeaker[]) {
      expect(copilotModeInstruction(s, "Alice")).toContain("Alice");
    }
  });
});

describe("lastSpeakerFromAuthorType — in-app authorType → last-speaker", () => {
  it("customer turn → customer (reply mode)", () => {
    expect(lastSpeakerFromAuthorType("customer")).toBe("customer");
  });

  it("agent turn → agent (follow-up mode)", () => {
    expect(lastSpeakerFromAuthorType("agent")).toBe("agent");
  });

  it("ai auto-reply → agent (OUR side spoke last — the non-obvious pin)", () => {
    // an AI auto-reply is sent on the agent's behalf; the customer hasn't replied to it, so it must
    // trigger follow-up mode exactly like an agent message, NOT be treated as the customer.
    expect(lastSpeakerFromAuthorType("ai")).toBe("agent");
  });

  it("system / unrecognised / missing → unknown (determine + default reply, no regression)", () => {
    expect(lastSpeakerFromAuthorType("system")).toBe("unknown");
    expect(lastSpeakerFromAuthorType("bot")).toBe("unknown");
    expect(lastSpeakerFromAuthorType(null)).toBe("unknown");
    expect(lastSpeakerFromAuthorType(undefined)).toBe("unknown");
    expect(lastSpeakerFromAuthorType("")).toBe("unknown");
  });
});
