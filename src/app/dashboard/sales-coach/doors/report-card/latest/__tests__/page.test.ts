import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /doors/report-card/latest — server redirect to the rep's most recent pitch's detail (founder 2026-08-24).
 * Pins: a present pitch → its detail; unauth / no pitch / read error → the Pitch Performance list (honest
 * fallback, never a dead end). `redirect` throws NEXT_REDIRECT in real Next, so the mock throws too and we
 * assert the target it was called with.
 */
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LatestPitchRedirect from "../page";

const LIST = "/dashboard/sales-coach/doors/report-card";

function fakeSb(opts: { user?: { id: string } | null; row?: { id: string } | null; err?: unknown }) {
  const { user = { id: "u1" }, row = null, err = null } = opts;
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      if (table !== "pitches") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: row, error: err }) }),
            }),
          }),
        }),
      };
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("report-card/latest redirect page", () => {
  it("redirects to the most recent pitch's detail", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSb({ row: { id: "p1" } }));
    await LatestPitchRedirect().catch(() => {}); // redirect() throws by design
    expect(redirect).toHaveBeenCalledWith(`${LIST}/p1`);
  });

  it("redirects to the list when the rep has no pitches yet (never a dead end)", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSb({ row: null }));
    await LatestPitchRedirect().catch(() => {});
    expect(redirect).toHaveBeenCalledWith(LIST);
  });

  it("redirects to the list on a read error (honest fallback, no dead end)", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSb({ err: { message: "boom" } }));
    await LatestPitchRedirect().catch(() => {});
    expect(redirect).toHaveBeenCalledWith(LIST);
  });

  it("redirects to the list when unauthenticated (the list carries the login guard)", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSb({ user: null }));
    await LatestPitchRedirect().catch(() => {});
    expect(redirect).toHaveBeenCalledWith(LIST);
  });
});
