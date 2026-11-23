import { describe, it, expect, vi, beforeEach } from "vitest";

/** POST topic-groups/suggest: managers only; only 2+-call ungrouped topics go to the model; nothing is stored. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({}) }));
const st = vi.hoisted(() => ({ prompt: "", text: "" }));
vi.mock("@/lib/claude", () => ({
  topicGroupCoach: vi.fn(async (a: { userMessage: string }) => {
    st.prompt = a.userMessage;
    return { text: st.text, suppressed: false };
  }),
}));
vi.mock("@/lib/coach/remote/marketRead", () => ({
  readMarketInputs: vi.fn(async () => ({
    ok: true,
    calls: ["a", "b"].map((id) => ({ sessionId: id, startedAt: "2026-11-20T10:00:00Z", outcome: null })),
    intel: new Map([
      ["a", { competitors: [], topics: ["pricing", "monthly price", "Jane's dog"] }],
      ["b", { competitors: [], topics: ["pricing", "monthly price"] }],
    ]),
  })),
  readTopicGroups: vi.fn(async () => ({ ok: true, groups: [] })),
}));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { POST } from "../route";

const req = () => new Request("http://x/api", { method: "POST", body: JSON.stringify({ module: "remote_sales" }) }) as never;
beforeEach(() => {
  st.prompt = "";
});

describe("topic-groups/suggest", () => {
  it("managers only", async () => {
    (requireSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    expect((await POST(req())).status).toBe(403);
  });
  it("sends only topics on 2+ calls and returns checked suggestions with their counts", async () => {
    st.text = '{"groups":[{"name":"Price","members":["pricing","monthly price"]}]}';
    const j = await (await POST(req())).json();
    expect(st.prompt).toContain("pricing — 2");
    expect(st.prompt).not.toContain("Jane");
    expect(j).toEqual({ offered: 2, suggestions: [{ name: "Price", members: ["pricing", "monthly price"], counts: [2, 2] }] });
  });
  it("unreadable model output is a 502, not an empty list", async () => {
    st.text = "sorry";
    expect((await POST(req())).status).toBe(502);
  });
});
