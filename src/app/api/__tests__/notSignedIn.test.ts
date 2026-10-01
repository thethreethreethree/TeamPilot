import { describe, it, expect, vi } from "vitest";

/**
 * NOT SIGNED IN IS A 401 (2026-10-01).
 *
 * An unauthenticated GET smoke of every API route on production (docs/mobile-smoke/all-get-routes.smoke.py)
 * found routes answering a caller with no login as if something else were wrong: /api/tasks and /api/team
 * said "Not authenticated" with a 400 (problems shares the helper), and /api/me/coach-memory returned a
 * zero-filled snapshot with a 200, so the growth page showed a blank history. Each now answers 401.
 */
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })),
}));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(), isAdminRole: vi.fn() }));
vi.mock("@/lib/coach/v5/memory", () => ({ loadCoachMemory: vi.fn(async () => ({ totalAnalyses: 0 })) }));

import * as tasks from "../tasks/route";
import * as team from "../team/route";
import * as problems from "../problems/route";
import * as coachMemory from "../me/coach-memory/route";
import { loadCoachMemory } from "@/lib/coach/v5/memory";

const req = (method: string) =>
  new Request("http://t/api/x?id=00000000-0000-0000-0000-000000000000", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({}),
  }) as never;

describe("a caller with no login gets 401, never a 400 or an empty 200", () => {
  it.each([
    ["tasks GET", () => tasks.GET()],
    ["tasks POST", () => tasks.POST(req("POST"))],
    ["tasks PATCH", () => tasks.PATCH(req("PATCH"))],
    ["tasks DELETE", () => tasks.DELETE(req("DELETE"))],
    ["team GET", () => team.GET()],
    ["team POST", () => team.POST(req("POST"))],
    ["team DELETE", () => team.DELETE(req("DELETE"))],
    ["problems POST", () => problems.POST(req("POST"))],
    ["problems PATCH", () => problems.PATCH(req("PATCH"))],
    ["coach-memory GET", () => coachMemory.GET()],
  ])("%s", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("coach-memory does not load anyone's memory for a stranger", async () => {
    await coachMemory.GET();
    expect(loadCoachMemory).not.toHaveBeenCalled();
  });
});
