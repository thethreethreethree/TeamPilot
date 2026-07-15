import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PATCH /api/tasks — server-side status-transition guard (route level).
 *
 * The map-level tests (statusLabels.test.ts) pin the graph; THIS pins that the
 * ROUTE actually enforces it. The bug it guards: the server transition map had
 * drifted (keyed a phantom 'New', omitted 'To Do'/'Needs Review'), so the route
 * REJECTED the most basic transition — To Do → In Progress — for API/mobile
 * callers (the web UI dodged it by writing status directly via the RLS client).
 * Fixed by importing the one shared allowedTaskTransitions. If the route ever
 * stops using the shared map (or the map regresses), the first test below fails.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));

import { createClient } from "@/lib/supabase/server";
import { PATCH } from "../route";

const ID = "11111111-1111-4111-8111-111111111111";

function fakeSb(opts: {
  currentStatus: string | null;
  blockerReason?: string | null;
  updateError?: unknown;
}) {
  const { currentStatus, blockerReason = null, updateError = null } = opts;
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { company_id: "co-1" } }) }),
          }),
        };
      }
      if (table === "tasks") {
        return {
          // current-state read (validation)
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data:
                  currentStatus === null
                    ? null
                    : { status: currentStatus, blocker_reason: blockerReason },
              }),
            }),
          }),
          // the final update
          update: () => ({ eq: async () => ({ error: updateError }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof PATCH>[0];
}

function mock(sb: unknown) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);
}

beforeEach(() => vi.clearAllMocks());

describe("PATCH task status transitions", () => {
  it("ALLOWS To Do → In Progress (the drift-bug fix — was rejected for API callers)", async () => {
    mock(fakeSb({ currentStatus: "To Do" }));
    const res = await PATCH(req({ id: ID, status: "In Progress" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("ALLOWS Needs Review → Completed (was also broken — key omitted)", async () => {
    mock(fakeSb({ currentStatus: "Needs Review" }));
    expect((await PATCH(req({ id: ID, status: "Completed" }))).status).toBe(200);
  });

  it("REJECTS an invalid transition (To Do → Completed) with 400", async () => {
    mock(fakeSb({ currentStatus: "To Do" }));
    const res = await PATCH(req({ id: ID, status: "Completed" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid status transition/i);
  });

  it("REJECTS → Blocked without a blocker reason (400)", async () => {
    mock(fakeSb({ currentStatus: "In Progress" }));
    const res = await PATCH(req({ id: ID, status: "Blocked" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/blocker reason/i);
  });

  it("ALLOWS → Blocked WITH a blocker reason", async () => {
    mock(fakeSb({ currentStatus: "In Progress" }));
    const res = await PATCH(
      req({ id: ID, status: "Blocked", blockerReason: "waiting on vendor SLA" })
    );
    expect(res.status).toBe(200);
  });

  it("404 when the task does not exist", async () => {
    mock(fakeSb({ currentStatus: null }));
    expect((await PATCH(req({ id: ID, status: "In Progress" }))).status).toBe(404);
  });
});
