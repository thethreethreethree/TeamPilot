import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * getOrCreateDraftMeetingPrep (audit D5 — orphan-draft-on-every-visit). The /prep page POSTs on mount, so
 * always-creating orphaned an empty prep on every visit-and-leave. The route now REUSES the caller's most-recent
 * TRULY-EMPTY draft — but "empty" is CONSERVATIVE (goal null + topics empty + draft status + no docs), so a prep
 * the user actually worked on is NEVER resurfaced (that would be worse than an orphan row). These pin exactly that:
 * reuse only a truly-empty draft; create fresh the moment ANY content (goal / topics / a document) exists.
 */

const opts = vi.hoisted(() => ({
  candidate: { data: null as unknown, error: null as { message: string } | null },
  created: { data: null as unknown, error: null as { message: string } | null },
  docs: { count: 0 as number | null, error: null as { message: string } | null },
}));

function docChain() {
  const c: Record<string, unknown> = { then: (r: (v: unknown) => void) => r(opts.docs) };
  for (const m of ["select", "eq"]) c[m] = () => c;
  return c;
}
function prepsChain() {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "order", "limit", "insert"]) c[m] = () => c;
  c.maybeSingle = async () => opts.candidate; // the reuse-candidate query
  c.single = async () => opts.created; // the create fallback (insert().select().single())
  return c;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (t: string) => (t === "meeting_prep_documents" ? docChain() : prepsChain()),
  }),
}));

import { getOrCreateDraftMeetingPrep } from "../meetingPrep";

const EMPTY_DRAFT = { id: "reused", company_id: "co1", created_by: "u1", goal: null, topics: [], status: "draft", session_id: null };
const FRESH = { id: "fresh", company_id: "co1", created_by: "u1", goal: null, topics: [], status: "draft", session_id: null };

beforeEach(() => {
  opts.candidate = { data: null, error: null };
  opts.created = { data: FRESH, error: null };
  opts.docs = { count: 0, error: null };
});

describe("getOrCreateDraftMeetingPrep — reuse only a TRULY-empty draft (audit D5)", () => {
  it("REUSES a truly-empty draft (goal null, topics empty, draft, 0 docs) — no new orphan", async () => {
    opts.candidate = { data: EMPTY_DRAFT, error: null };
    opts.docs = { count: 0, error: null };
    const prep = await getOrCreateDraftMeetingPrep({ companyId: "co1" });
    expect(prep?.id).toBe("reused");
  });

  it("creates FRESH when there is no empty draft (latest has a goal → goal-null query returns nothing)", async () => {
    opts.candidate = { data: null, error: null }; // no goal-null draft exists
    const prep = await getOrCreateDraftMeetingPrep({ companyId: "co1" });
    expect(prep?.id).toBe("fresh");
  });

  it("creates FRESH when the empty-goal draft already has TOPICS (user worked on it)", async () => {
    opts.candidate = { data: { ...EMPTY_DRAFT, topics: [{ id: "t1", text: "budget", covered: false }] }, error: null };
    const prep = await getOrCreateDraftMeetingPrep({ companyId: "co1" });
    expect(prep?.id).toBe("fresh"); // never resurface a prep with content
  });

  it("creates FRESH when the empty draft already has a DOCUMENT (doc count > 0)", async () => {
    opts.candidate = { data: EMPTY_DRAFT, error: null };
    opts.docs = { count: 2, error: null };
    const prep = await getOrCreateDraftMeetingPrep({ companyId: "co1" });
    expect(prep?.id).toBe("fresh");
  });

  it("creates FRESH when the reuse probe ERRORS (never block starting a prep on the optimization)", async () => {
    opts.candidate = { data: null, error: { message: "conn reset" } };
    const prep = await getOrCreateDraftMeetingPrep({ companyId: "co1" });
    expect(prep?.id).toBe("fresh");
  });
});
