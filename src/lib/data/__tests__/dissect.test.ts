import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * DB data-layer unit test for the Dissect topics store via a mocked Supabase
 * client (no live DB). Verifies the query shape (table, ordering, id scope), the
 * snake_case → camelCase transform, honest null/[] on empty, and — load-bearing —
 * that saveDissectTopic derives company_id/user_id from the SESSION, never from
 * the args (the tenant/owner keys are server-forced, matching the 0097 RLS +
 * the A23 authz-column discipline).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { listDissectTopics, getDissectTopic, saveDissectTopic } from "../dissect";

const FULL_ROW = {
  id: "d1",
  title: "The deploy problem",
  source_text: "Alex: the deploy keeps failing at the migration step.",
  summary: "A failing deploy.",
  dissect: { hasSignal: true, problem: { statement: "The deploy fails." } },
  created_at: "2026-07-07T10:00:00Z",
};

describe("dissect data layer (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;

  beforeEach(() => {
    calls = [];
    vi.clearAllMocks();
  });

  it("listDissectTopics queries dissect_topics newest-first and maps rows", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ dissect_topics: { data: [FULL_ROW] } }, calls) as never
    );
    const list = await listDissectTopics();
    expect(calls.some(([m, a]) => m === "from" && a[0] === "dissect_topics")).toBe(true);
    expect(
      calls.some(([m, a]) => m === "order" && a[0] === "created_at")
    ).toBe(true);
    expect(list).toEqual([
      { id: "d1", title: "The deploy problem", createdAt: "2026-07-07T10:00:00Z" },
    ]);
  });

  it("listDissectTopics returns [] on no rows", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ dissect_topics: { data: null } }, calls) as never
    );
    expect(await listDissectTopics()).toEqual([]);
  });

  it("getDissectTopic scopes by id and maps the full row incl. dissect jsonb", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ dissect_topics: { data: FULL_ROW } }, calls) as never
    );
    const topic = await getDissectTopic("d1");
    expect(
      calls.some(([m, a]) => m === "eq" && a[0] === "id" && a[1] === "d1")
    ).toBe(true);
    expect(topic).toMatchObject({
      id: "d1",
      sourceText: "Alex: the deploy keeps failing at the migration step.",
      summary: "A failing deploy.",
    });
    expect(topic?.dissect).toMatchObject({ hasSignal: true });
  });

  it("getDissectTopic returns null when not found (RLS → no row for another user)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ dissect_topics: { data: null } }, calls) as never
    );
    expect(await getDissectTopic("nope")).toBeNull();
  });

  // Migration-coupling resilience — the 2026-07-03 Team Chat outage lesson applied to
  // the 0097-coupled dissect store: a missing table (migration not applied yet) must
  // DEGRADE (list → [], surface stays up) AND be DIAGNOSABLE (server log), never a
  // silent empty indistinguishable from "no saved topics", and never an uncaught throw.
  it("listDissectTopics returns [] AND logs on a missing-table error (0097 not applied)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        {
          dissect_topics: {
            data: null,
            error: { code: "42P01", message: 'relation "dissect_topics" does not exist' },
          },
        },
        calls
      ) as never
    );
    // Graceful: an empty list, not a throw — the surface (analyze) stays usable.
    expect(await listDissectTopics()).toEqual([]);
    // Diagnosable + distinguished: the log names the missing-migration cause.
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(String(errSpy.mock.calls[0]?.[0])).toContain("0097");
    errSpy.mockRestore();
  });

  it("saveDissectTopic returns null AND logs on a write error (never a phantom save)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getCurrentAuthContext).mockResolvedValue({
      userId: "u1",
      companyId: "co1",
      role: "admin",
      isAdmin: true,
    } as never);
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        {
          dissect_topics: {
            data: null,
            error: { code: "23505", message: "duplicate key" },
          },
        },
        calls
      ) as never
    );
    const id = await saveDissectTopic({ title: "T", sourceText: "S", summary: null, dissect: null });
    expect(id).toBeNull(); // §3.4 — no phantom save
    expect(errSpy).toHaveBeenCalledTimes(1); // the real reason is on the record
    errSpy.mockRestore();
  });

  it("saveDissectTopic returns null when not authenticated (never a phantom save)", async () => {
    vi.mocked(getCurrentAuthContext).mockResolvedValue(null);
    const id = await saveDissectTopic({
      title: "t",
      sourceText: "s",
      summary: null,
      dissect: null,
    });
    expect(id).toBeNull();
  });

  it("saveDissectTopic forces company_id/user_id from the session, not the caller", async () => {
    vi.mocked(getCurrentAuthContext).mockResolvedValue({
      userId: "u1",
      companyId: "co1",
      role: "admin",
      isAdmin: true,
    } as never);
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ dissect_topics: { data: { id: "new1" } } }, calls) as never
    );
    const id = await saveDissectTopic({
      title: "T",
      sourceText: "S",
      summary: "sum",
      dissect: null,
    });
    expect(id).toBe("new1");
    const insertCall = calls.find(([m]) => m === "insert");
    expect(insertCall).toBeTruthy();
    const inserted = insertCall![1][0] as Record<string, unknown>;
    // The security property: tenant + owner come from the authenticated session.
    expect(inserted.company_id).toBe("co1");
    expect(inserted.user_id).toBe("u1");
  });
});
