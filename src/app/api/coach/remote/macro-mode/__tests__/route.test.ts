import { describe, it, expect, vi, beforeEach } from "vitest";

/** /api/coach/remote/macro-mode — each person's own switch, separate from Sales Coach's (2026-11-23). */
const st = vi.hoisted(() => ({
  user: { id: "rep-1" } as null | { id: string },
  updates: [] as Array<{ row: unknown; id: string }>,
  updated: { data: { remote_macro_mode_enabled: true }, error: null } as { data: unknown; error: unknown },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    auth: { getUser: async () => ({ data: { user: st.user } }) },
    from: () => ({
      update: (row: unknown) => ({
        eq: (_c: string, id: string) => {
          st.updates.push({ row, id });
          return { select: () => ({ maybeSingle: async () => st.updated }) };
        },
      }),
    }),
  }),
}));

import { POST } from "../route";

const post = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never);

beforeEach(() => {
  st.user = { id: "rep-1" };
  st.updates = [];
  st.updated = { data: { remote_macro_mode_enabled: true }, error: null };
});

describe("Remote Sales Macro Mode switch", () => {
  it("sets the Remote Sales column on the caller's OWN profile only", async () => {
    expect(await (await post({ enabled: true })).json()).toEqual({ enabled: true });
    expect(st.updates).toEqual([{ row: { remote_macro_mode_enabled: true }, id: "rep-1" }]);
  });

  it("a write that matched no row is an error, never an echo of what was asked", async () => {
    st.updated = { data: null, error: null };
    expect((await post({ enabled: true })).status).toBe(500);
  });

  it("signed out → 401, nothing written", async () => {
    st.user = null;
    expect((await post({ enabled: true })).status).toBe(401);
    expect(st.updates).toEqual([]);
  });

  it("only a boolean is accepted", async () => {
    expect((await post({ enabled: "yes" })).status).toBe(400);
    expect(st.updates).toEqual([]);
  });
});
