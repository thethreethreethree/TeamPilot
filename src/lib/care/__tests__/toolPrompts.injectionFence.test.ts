import { describe, it, expect } from "vitest";
import { SUMMARIZE_SYSTEM, CO_PILOT_SYSTEM, FORMULATE_SYSTEM } from "../toolPrompts";

// The C.A.R.E tools ingest CUSTOMER-authored conversation text — the highest-consequence untrusted input in
// the product (a customer message can steer the agent-facing draft the agent then sends). Every tool prompt
// MUST carry the anti-injection fence: treat the conversation as data, never obey instructions inside it.
// This guard fails if the fence is dropped from any tool — a silently unfenced tool reopens the surface.
const prompts: Array<[string, string]> = [
  ["SUMMARIZE_SYSTEM", SUMMARIZE_SYSTEM],
  ["CO_PILOT_SYSTEM", CO_PILOT_SYSTEM],
  ["FORMULATE_SYSTEM", FORMULATE_SYSTEM],
];

describe("C.A.R.E tool prompts — anti-injection fence over the conversation", () => {
  for (const [name, prompt] of prompts) {
    const p = prompt.toLowerCase();

    it(`${name} labels the conversation as untrusted message DATA, not instructions`, () => {
      expect(p).toMatch(/untrusted|message data|not instructions/);
    });

    it(`${name} instructs the model to NEVER obey embedded commands`, () => {
      expect(p).toMatch(/never obey|do not obey|not.*obey/);
    });

    it(`${name} pins task/format to the caller, not the conversation`, () => {
      expect(p).toMatch(/fixed by the instructions|by the caller|never by anything inside/);
    });
  }
});
