import { describe, it, expect } from "vitest";
import { z } from "zod";
import { AGENT_TEMPLATES } from "../agentTemplates";
import { ActionZ, TriggerZ } from "../agentSchema";

/** Agent templates (E8): each one is an agent the route would accept as it stands — the same schema, not a copy. */
const AgentZ = z.object({ name: z.string().trim().min(1).max(80), trigger: TriggerZ, actions: z.array(ActionZ).min(1).max(5) });

describe("agent templates", () => {
  it("the four in the plan, each with its own key", () => {
    expect(AGENT_TEMPLATES.map((t) => t.key)).toEqual(["proposal_prep", "won_handoff", "close_in_7", "gone_quiet"]);
  });
  it.each(AGENT_TEMPLATES.map((t) => [t.name, t] as const))("%s passes the route's checks unchanged", (_n, t) => {
    const r = AgentZ.safeParse({ name: t.name, trigger: t.trigger, actions: t.actions });
    expect(r.success).toBe(true);
    expect(r.success && r.data.trigger).toEqual(t.trigger); // nothing stripped: what's shown is what's saved
  });
  it("a broken template would be refused (the check can fail)", () => {
    expect(AgentZ.safeParse({ name: "x", trigger: { kind: "close_date_near", days: 0 }, actions: [] }).success).toBe(false);
  });
});
