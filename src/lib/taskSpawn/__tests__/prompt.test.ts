import { describe, it, expect } from "vitest";
import { buildSpawnSystemPrompt, buildSpawnUserMessage } from "../prompt";
import type { SpawnContextType, SpawnContextPayload, SpawnedTaskDraft } from "../types";

/**
 * Task-spawn prompt assembly. The header rules demand "PRESERVE THE INTENT / NO INVENTION", so the load-bearing
 * property is that the RIGHT source context reaches the model per surface — and, just as important, that one
 * surface's fields don't bleed into another (spawning a task from a chat must not smuggle in decision fields).
 * Pure module, was untested.
 */

const um = (
  contextType: SpawnContextType,
  payload: Partial<SpawnContextPayload>,
  extra: { previousTaskDraft?: SpawnedTaskDraft; adjustmentPrompt?: string } = {}
) => buildSpawnUserMessage({ contextType, contextPayload: payload as SpawnContextPayload, ...extra });

describe("buildSpawnSystemPrompt", () => {
  it("carries the intent-preservation rules and varies the presentation by surface", () => {
    const dec = buildSpawnSystemPrompt({ contextType: "decision", isRefinement: false });
    const chat = buildSpawnSystemPrompt({ contextType: "chat_messages", isRefinement: false });
    expect(dec).toContain("PRESERVE THE INTENT");
    expect(dec).not.toBe(chat); // CONTEXT_PRESENTATIONS differs per surface
  });

  it("refinement mode is a distinct prompt from the initial spawn", () => {
    const initial = buildSpawnSystemPrompt({ contextType: "decision", isRefinement: false });
    const refine = buildSpawnSystemPrompt({ contextType: "decision", isRefinement: true });
    expect(refine).not.toBe(initial);
  });
});

describe("buildSpawnSystemPrompt — agent-identity anchor (role attribution, founder report 2026-07-24)", () => {
  it("injects a WHO-IS-WHO anchor naming the agent for a scanned chat thread", () => {
    const out = buildSpawnSystemPrompt({
      contextType: "chat_messages",
      isRefinement: false,
      agentName: "John Ramos",
    });
    expect(out).toContain("WHO IS WHO");
    expect(out).toContain("John Ramos");
    // Establishes John as the AGENT (not the customer) — the exact bug that was reported.
    expect(out).toMatch(/John Ramos[^]*agent/i);
  });

  it("omits the anchor when no agentName is given (in-app spawn passes real per-message labels)", () => {
    const out = buildSpawnSystemPrompt({ contextType: "chat_messages", isRefinement: false });
    expect(out).not.toContain("WHO IS WHO");
  });

  it("does not add the scanned-thread anchor to the decision surface (already role-structured)", () => {
    const out = buildSpawnSystemPrompt({
      contextType: "decision",
      isRefinement: false,
      agentName: "John Ramos",
    });
    expect(out).not.toContain("WHO IS WHO");
  });
});

describe("buildSpawnUserMessage", () => {
  it("decision surface includes the decision's situation and proposal", () => {
    const out = um("decision", {
      decisionSituation: "raise prices?",
      decisionProposal: "raise 10%",
    } as Partial<SpawnContextPayload>);
    expect(out).toContain("raise prices?");
    expect(out).toContain("raise 10%");
  });

  it("does NOT bleed decision fields into a chat_messages spawn (contextType gates the section)", () => {
    const out = um("chat_messages", {
      chatTopicTitle: "Latency spike",
      decisionSituation: "SHOULD-NOT-APPEAR",
    } as Partial<SpawnContextPayload>);
    expect(out).toContain("Latency spike");
    expect(out).not.toContain("SHOULD-NOT-APPEAR");
  });

  it("chat surface includes the title and the selected messages (the focus)", () => {
    const out = um("chat_messages", {
      chatTopicTitle: "Onboarding bug",
      selectedMessages: [{ author: "Sam", body: "repro on step 3" }],
    } as Partial<SpawnContextPayload>);
    expect(out).toContain("Onboarding bug");
    expect(out).toContain("repro on step 3");
  });

  it("includes the previous draft + adjustment request on a revision pass", () => {
    const out = um(
      "decision",
      { decisionSituation: "x" } as Partial<SpawnContextPayload>,
      {
        previousTaskDraft: { title: "Ship fix", steps: ["a"] } as unknown as SpawnedTaskDraft,
        adjustmentPrompt: "make it two steps",
      }
    );
    expect(out).toContain("PREVIOUS DRAFT");
    expect(out).toContain("Ship fix");
    expect(out).toContain("USER'S ADJUSTMENT REQUEST");
    expect(out).toContain("make it two steps");
  });
});
