import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/decisions — persists a Decision Dialogue + its outcome row. Previously untested.
 * The behaviour worth pinning: the two writes are atomic-ish — if the dialogue capture fails AFTER the decision
 * row is inserted, the decision is ROLLED BACK (deleted) so a retry produces exactly one row, and the WHY is
 * never silently lost. Plus the auth/onboarding gates and generic-500-no-leak (CWE-209) on both write paths.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));

import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

function fakeSb(o: {
  user?: { id: string } | null;
  company?: string | null;
  decisionErr?: unknown;
  dialogueErr?: unknown;
}) {
  const state = { deleted: false };
  const sb = {
    _state: state,
    auth: { getUser: async () => ({ data: { user: o.user === undefined ? { id: "u1" } : o.user } }) },
    from: (t: string) => {
      if (t === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: o.company === null ? null : { company_id: o.company ?? "co1" } }),
            }),
          }),
        };
      }
      if (t === "decisions") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: o.decisionErr ? null : { id: "d1" }, error: o.decisionErr ?? null }),
            }),
          }),
          delete: () => ({
            eq: async () => {
              state.deleted = true;
              return { error: null };
            },
          }),
        };
      }
      if (t === "decision_dialogues") {
        return { insert: async () => ({ error: o.dialogueErr ?? null }) };
      }
      return {};
    },
  };
  return sb;
}

const mock = (sb: unknown) => (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);
const body = () => ({
  situation: "Renewal at risk",
  userDiagnosis: "Champion left",
  userProposal: "Re-map stakeholders",
  systemResponse: { engagement: "ok", addedPerspective: "budget cycle", suggestion: { action: "a", why: "w" }, comparison: "c" },
  chosenPath: "hybrid",
  title: "Save the renewal",
});
const req = (b: unknown) => ({ json: async () => b }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/decisions", () => {
  it("401 unauthenticated", async () => {
    mock(fakeSb({ user: null }));
    expect((await POST(req(body()))).status).toBe(401);
  });

  it("400 before onboarding (no company)", async () => {
    mock(fakeSb({ company: null }));
    expect((await POST(req(body()))).status).toBe(400);
  });

  it("200 and returns the decisionId when both writes land", async () => {
    mock(fakeSb({}));
    const res = await POST(req(body()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ decisionId: "d1" });
  });

  it("ROLLS BACK the decision when dialogue capture fails (deletes it, generic 500, no leak)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sb = fakeSb({ dialogueErr: { message: "internal pg detail: dialogues fk" } });
    mock(sb);
    const res = await POST(req(body()));
    expect(res.status).toBe(500);
    expect(sb._state.deleted).toBe(true); // the partial decision was rolled back
    const j = await res.json();
    expect(j.error).toMatch(/rolled back/i);
    expect(JSON.stringify(j)).not.toContain("internal pg detail");
  });

  it("500 without leaking when the decision insert itself fails (no rollback needed)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sb = fakeSb({ decisionErr: { message: "internal pg detail: decisions rls" } });
    mock(sb);
    const res = await POST(req(body()));
    expect(res.status).toBe(500);
    expect(sb._state.deleted).toBe(false);
    const j = await res.json();
    expect(j.error).toBe("Couldn't save the decision.");
    expect(JSON.stringify(j)).not.toContain("internal pg detail");
  });
});
