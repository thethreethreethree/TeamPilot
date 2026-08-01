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
import { PATCH, POST } from "../route";

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

  it("500s on a DB update error WITHOUT leaking the raw message (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock(
      fakeSb({
        currentStatus: "To Do",
        updateError: { code: "XX000", message: "internal pg detail: tasks rls policy" },
      })
    );
    const res = await PATCH(req({ id: ID, status: "In Progress" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Couldn't update the task.");
    expect(JSON.stringify(body)).not.toContain("internal pg detail");
  });
});

/**
 * POST create — the "a Blocked task must carry a reason" guarantee, on the CREATE path.
 * PATCH enforced it; POST did not, so a task could be created directly as Blocked with
 * no reason (the primary bypass the board advertises the API prevents). This pins the
 * create-side enforcement (the board modal already has the field, so no new UX).
 */
function createSb() {
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
          insert: () => ({
            select: () => ({ single: async () => ({ data: { id: "new-1" }, error: null }) }),
          }),
        };
      }
      if (table === "task_steps") {
        return { insert: async () => ({ error: null }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("POST create — blocker_reason guarantee", () => {
  it("REJECTS creating a Blocked task with no reason (400)", async () => {
    mock(createSb());
    const res = await POST(req({ title: "Fix the thing", status: "Blocked" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/blocker reason/i);
  });

  it("REJECTS a Blocked task with a whitespace-only reason (400)", async () => {
    mock(createSb());
    const res = await POST(req({ title: "X", status: "Blocked", blockerReason: "   " }));
    expect(res.status).toBe(400);
  });

  it("ALLOWS a Blocked task WITH a reason", async () => {
    mock(createSb());
    const res = await POST(req({ title: "X", status: "Blocked", blockerReason: "waiting on vendor" }));
    expect(res.status).toBe(200);
  });

  it("ALLOWS a non-Blocked task with no reason (To Do)", async () => {
    mock(createSb());
    const res = await POST(req({ title: "X", status: "To Do" }));
    expect(res.status).toBe(200);
  });
});

/**
 * POST create — input validation via the shared TaskCreateSchema.
 *
 * The bug this guards: POST inserted body.status / body.priority /
 * body.aiPriorityScore RAW, with no DB CHECK behind them. A crafted request could
 * create a task with a NON-CANONICAL status ("Foobar"), and since that status has
 * no outgoing edges in allowedTaskTransitions() it becomes permanently
 * un-transitionable — a jammed row the board can never move. The route now parses
 * the core fields through the schema whose enums are derived from statusLabels.
 */
describe("POST create — schema validation", () => {
  it("REJECTS a non-canonical status (the jam-the-state-machine bug) with 400", async () => {
    mock(createSb());
    const res = await POST(req({ title: "X", status: "Foobar" }));
    expect(res.status).toBe(400);
  });

  it("REJECTS a non-canonical priority with 400", async () => {
    mock(createSb());
    expect((await POST(req({ title: "X", priority: "SUPER-URGENT" }))).status).toBe(400);
  });

  it("REJECTS an out-of-range aiPriorityScore (>100) with 400", async () => {
    mock(createSb());
    expect((await POST(req({ title: "X", aiPriorityScore: 9999 }))).status).toBe(400);
  });

  it("REJECTS a missing/empty title with 400", async () => {
    mock(createSb());
    expect((await POST(req({ title: "" }))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
  });

  it("REJECTS an oversized title (>200 chars) with 400", async () => {
    mock(createSb());
    expect((await POST(req({ title: "a".repeat(201) }))).status).toBe(400);
  });

  it("ACCEPTS a valid canonical create (To Do / Medium)", async () => {
    mock(createSb());
    const res = await POST(
      req({ title: "Real task", status: "To Do", priority: "Medium", aiPriorityScore: 50 })
    );
    expect(res.status).toBe(200);
  });
});
