import { describe, it, expect, vi } from "vitest";

/**
 * Assistant route. Pins the A31 write-path seam: a proposal for a known employee generates the correct events
 * a manager can Apply (SHIFT_DEFINED + EMPLOYEE_ASSIGNED for a new shift), an unknown name is BLOCKED (no
 * guessed write), and the route is manager-only. The LLM is mocked; parseAssistantReply is tested separately.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/schedule/assistant", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, interpretCommand: vi.fn() };
});

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { interpretCommand } from "@/lib/schedule/assistant";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const EMP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0];

function fakeSb(emp: unknown[]) {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain, eq: () => chain, order: () => chain,
        range: async () => ({ data: table === "schedule_employee" ? emp : [], error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return chain;
    },
  };
}
const empRow = { id: EMP, company_id: "c1", name: "Darren Guzman", role: null, employment_type: null, skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active" };

describe("schedule assistant API — write-path (A31)", () => {
  it("an assign proposal for a known employee yields SHIFT_DEFINED + EMPLOYEE_ASSIGNED to Apply", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb([empRow]));
    asMock(interpretCommand).mockResolvedValue({
      reply: "I'll set that up.",
      actions: [{ op: "assign", employee: "Darren Guzman", date: "2099-01-05", start: "09:00", end: "17:00" }],
    });
    const res = await POST(req({ message: "give Darren the 9-5 on Jan 5" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.proposals).toHaveLength(1);
    const p = j.proposals[0];
    expect(p.blocked).toBe(false);
    expect(p.events.map((e: { type: string }) => e.type)).toEqual(["SHIFT_DEFINED", "EMPLOYEE_ASSIGNED"]);
    expect(p.events[0].payload).toMatchObject({ date: "2099-01-05", start: "09:00", end: "17:00", requiredHeadcount: 1 });
    expect(p.events[1].payload.employeeId).toBe(EMP); // resolved name → id
    expect(p.events[0].payload.shiftId).toBe(p.events[1].payload.shiftId); // assign references the new shift
  });

  it("an unknown employee is BLOCKED, not a guessed write", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb([empRow]));
    asMock(interpretCommand).mockResolvedValue({
      reply: "ok", actions: [{ op: "assign", employee: "Nobody Here", date: "2099-01-05", start: "09:00", end: "17:00" }],
    });
    const j = await (await POST(req({ message: "x" }))).json();
    expect(j.proposals[0].blocked).toBe(true);
    expect(j.proposals[0].events).toEqual([]);
  });

  it("a pure question returns the reply with no proposals", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb([empRow]));
    asMock(interpretCommand).mockResolvedValue({ reply: "Darren works Monday.", actions: [] });
    const j = await (await POST(req({ message: "who works monday?" }))).json();
    expect(j.reply).toContain("Darren");
    expect(j.proposals).toEqual([]);
  });

  it("a non-manager is refused (403)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(fakeSb([empRow]));
    expect((await POST(req({ message: "x" }))).status).toBe(403);
  });

  it("401 unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    asMock(createClient).mockResolvedValue(fakeSb([empRow]));
    expect((await POST(req({ message: "x" }))).status).toBe(401);
  });
});
