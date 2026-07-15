import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/admin/team-check/nudge — authz + terminal-task contract.
 *
 * A nudge inserts a task_message of kind='nudge', which the 0021 trigger turns
 * into a durable `task.nudge_sent` event on the §3.1 chain. So the route must
 * gate WHO can nudge (admin, same tenant) and WHAT can be nudged (an OPEN task).
 *
 * The terminal-task guard is the one these tests exist to pin: it must reject a
 * COMPLETED task AND a CANCELLED one. Before the §A26 class fix it only excluded
 * 'Completed', so an admin could nudge a deliberately-cancelled task and write a
 * durable event for closed work. If a regression drops 'Cancelled' from
 * isTaskClosed (or reverts this guard to `=== 'Completed'`), the cancelled-task
 * test below fails.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: "admin-1" };
const COMPANY = "co-1";

type Task = {
  id: string;
  company_id: string;
  status: string;
  deleted_at: string | null;
};

/** One user client dispatching profiles / tasks / task_messages by table. */
function fakeSb(opts: {
  user?: { id: string } | null;
  profile?: { role: string; company_id: string | null } | null;
  task?: Task | null;
  taskErr?: unknown;
  insertOk?: boolean;
}) {
  const {
    user = ADMIN,
    profile = { role: "CEO", company_id: COMPANY },
    task = null,
    taskErr = null,
    insertOk = true,
  } = opts;
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }),
          }),
        };
      }
      if (table === "tasks") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: task, error: taskErr }) }),
          }),
        };
      }
      if (table === "task_messages") {
        return {
          insert: () => ({
            select: () => ({
              single: async () =>
                insertOk
                  ? { data: { id: "msg-1", task_id: TASK_ID, kind: "nudge" }, error: null }
                  : { data: null, error: { message: "insert failed" } },
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function req(body: unknown = { taskId: TASK_ID, body: "Checking in — anything blocking this?" }) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

function openTask(status: string): Task {
  return { id: TASK_ID, company_id: COMPANY, status, deleted_at: null };
}

beforeEach(() => vi.clearAllMocks());

describe("nudge terminal-task guard", () => {
  it("rejects a CANCELLED task (the §A26 fix — 400, no insert)", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({ task: openTask("Cancelled") })
    );
    const res = await POST(req());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.toLowerCase()).toContain("cancelled");
  });

  it("rejects a COMPLETED task (400)", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({ task: openTask("Completed") })
    );
    const res = await POST(req());
    expect(res.status).toBe(400);
  });

  it("allows an OPEN task (In Progress) through to the insert", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({ task: openTask("In Progress") })
    );
    const res = await POST(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message.kind).toBe("nudge");
  });

  it("allows a BLOCKED task (blocked is open, not terminal)", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({ task: openTask("Blocked") })
    );
    const res = await POST(req());
    expect(res.status).toBe(200);
  });
});

describe("nudge authz", () => {
  it("401 when unauthenticated", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({ user: null })
    );
    expect((await POST(req())).status).toBe(401);
  });

  it("403 for a non-admin (Member)", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({ profile: { role: "Member", company_id: COMPANY }, task: openTask("To Do") })
    );
    expect((await POST(req())).status).toBe(403);
  });

  it("403 cross-tenant (task belongs to another company)", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({ task: { id: TASK_ID, company_id: "other-co", status: "To Do", deleted_at: null } })
    );
    expect((await POST(req())).status).toBe(403);
  });

  it("404 when the task is missing or soft-deleted", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({ task: null })
    );
    expect((await POST(req())).status).toBe(404);
  });
});
