import { describe, it, expect } from "vitest";
import { DISTILL_SYSTEM_PROMPT } from "../learn";

// The learning cycle feeds diagnostic records (problem titles/diagnoses, resolution notes) into an LLM to
// distill brain updates. Those fields can indirectly carry text authored by team members or customers, so the
// distill system prompt MUST fence them as data, not instructions (the flagged company_brain prompt-injection
// concern; ingestion-side hardening per §A27). This guard fails if that fence is ever removed — a silently
// unfenced learning cycle is exactly the regression that reopens the injection surface.
describe("DISTILL_SYSTEM_PROMPT — anti-injection fence over the activity data", () => {
  const p = DISTILL_SYSTEM_PROMPT.toLowerCase();

  it("carries an explicit security fence", () => {
    expect(p).toContain("security");
  });

  it("labels the activity as untrusted DATA, not instructions", () => {
    // Some phrasing that frames the fields as observations/data rather than commands.
    expect(p).toMatch(/untrusted|as (an )?observation|data.*not.*instruction|purely as/);
  });

  it("instructs the model to NOT obey embedded instructions", () => {
    expect(p).toMatch(/do not obey|ignore it|never (obey|act on)/);
  });

  it("pins the output to the strict JSON regardless of injected instructions", () => {
    // Even under an injection attempt, the only output is the specified JSON.
    expect(p).toMatch(/only output is the strict json|your only output/);
  });
});
