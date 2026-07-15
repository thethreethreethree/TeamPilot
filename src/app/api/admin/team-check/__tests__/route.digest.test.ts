import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/admin/team-check — digest filter + authz contract.
 *
 * The digest surfaces (user, task) pairs that may need an admin check-in. A
 * TERMINAL task needs none — it's done business — so the filter must exclude
 * BOTH Completed and Cancelled. Before the §A26 class fix it excluded only
 * Completed, so a deliberately-cancelled task surfaced as "stale, needs a nudge":
 * a false admin action item. These tests pin the exclusion + the admin gate so a
 * regression that drops 'Cancelled' (or the admin gate) fails here.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

const ADMIN = { id: "admin-1" };
const ADMIN_PROFILE = { role: "CEO", company_id: "co-1" };
// Far in the past → always older than the STALE_DAYS cutoff, so the row is stale.
const OLD = "2020-01-01T00:00:00Z";

type Task = { id: string; title: string; status: string; priority: string; deleted_at: string | null };

function task(id: string, status: string): Task {
  return { id, title: `Task ${id}`, status, priority: "Medium", deleted_at: null };
}

function partRow(userId: string, t: Task) {
  return {
    task_id: t.id,
    user_id: userId,
    role: "Member",
    joined_at: OLD,
    left_at: null,
    last_engaged_at: null, // no engagement + old join = stale
    engagement_count: 0,
    tasks: [t], // PostgREST returns the embedded resource as an array
  };
}

function fakeSb(opts: {
  user?: { id: string } | null;
  profile?: { role: string; company_id: string | null } | null;
  rows?: unknown[];
  names?: { id: string; full_name: string }[];
}) {
  const { user = ADMIN, profile = ADMIN_PROFILE, rows = [], names = [] } = opts;
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            // admin-gate read
            eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }),
            // name-resolution batch (only reached when ≥1 row survives the filter)
            or: async () => ({ data: names, error: null }),
          }),
        };
      }
      if (table === "task_participants") {
        return {
          select: () => ({ is: async () => ({ data: rows, error: null }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function mock(sb: unknown) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);
}

beforeEach(() => vi.clearAllMocks());

describe("team-check digest terminal-task exclusion", () => {
  it("excludes a CANCELLED task's stale participant (the §A26 fix)", async () => {
    mock(
      fakeSb({
        rows: [
          partRow("u-open", task("t-open", "In Progress")),
          partRow("u-cancel", task("t-cancel", "Cancelled")),
        ],
        names: [
          { id: "u-open", full_name: "Ada" },
          { id: "u-cancel", full_name: "Bo" },
        ],
      })
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const { rows } = await res.json();
    const taskIds = rows.map((r: { taskId: string }) => r.taskId);
    expect(taskIds).toContain("t-open");
    expect(taskIds).not.toContain("t-cancel");
  });

  it("excludes a COMPLETED task's stale participant", async () => {
    mock(fakeSb({ rows: [partRow("u1", task("t-done", "Completed"))] }));
    const { rows } = await (await GET()).json();
    expect(rows).toHaveLength(0);
  });

  it("includes an OPEN stale participant", async () => {
    mock(
      fakeSb({
        rows: [partRow("u1", task("t1", "In Progress"))],
        names: [{ id: "u1", full_name: "Cy" }],
      })
    );
    const { rows } = await (await GET()).json();
    expect(rows).toHaveLength(1);
    expect(rows[0].taskStatus).toBe("In Progress");
  });
});

describe("team-check digest authz", () => {
  it("401 when unauthenticated", async () => {
    mock(fakeSb({ user: null }));
    expect((await GET()).status).toBe(401);
  });

  it("403 for a non-admin (Member)", async () => {
    mock(fakeSb({ profile: { role: "Member", company_id: "co-1" } }));
    expect((await GET()).status).toBe(403);
  });
});
