import { describe, it, expect } from "vitest";
import { publicStatus } from "../publicStatus";

describe("publicStatus (F36.34)", () => {
  const h = (o: { db?: boolean; ai?: boolean; email?: boolean; webhooks?: boolean }) => ({
    backend: { supabase: { reachable: o.db ?? true } },
    capabilities: { llmReady: o.ai ?? true, email: o.email ?? true, webhooks: o.webhooks ?? true },
  });
  it("all working → ok", () => {
    expect(publicStatus(h({})).overall).toBe("ok");
  });
  it("a part not set up is 'not switched on', not an outage", () => {
    const s = publicStatus(h({ email: false, webhooks: false }));
    expect(s.overall).toBe("ok");
    expect(s.parts.filter((p) => p.state === "off").map((p) => p.name)).toEqual(["Email notices", "Webhooks and CRM sends"]);
  });
  it("data or AI unreachable → degraded, naming the part", () => {
    const s = publicStatus(h({ ai: false }));
    expect(s.overall).toBe("degraded");
    expect(s.parts.find((p) => p.name === "AI coaching")).toMatchObject({ state: "down", note: "Not available right now" });
  });
  it("no health answer → unknown, nothing claimed", () => {
    expect(publicStatus(null)).toEqual({ overall: "unknown", parts: [] });
  });
});
