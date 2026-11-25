import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  },
}));
import { matchHidePhrases, scanCallForHidePhrases } from "../hidePhrases";

describe("scanCallForHidePhrases never throws (it runs inside call processing)", () => {
  it("no service-role client → null, not a rejection", async () => {
    await expect(scanCallForHidePhrases(null, "s1")).resolves.toBeNull();
  });
  it("a failed session read → null (unknown), not [] (checked, nothing matched)", async () => {
    const q: Record<string, unknown> = {};
    for (const m of ["from", "select", "eq"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: null, error: { message: "boom" } });
    await expect(scanCallForHidePhrases(q as never, "s1")).resolves.toBeNull();
  });
});

describe("matchHidePhrases (0337)", () => {
  const P = [{ id: "p1", phrase: "personal call" }, { id: "p2", phrase: "off the record" }];
  it("finds a phrase in any case and spacing, as whole words", () => {
    expect(matchHidePhrases("Sorry, this is a  PERSONAL\ncall for a sec", P).map((p) => p.id)).toEqual(["p1"]);
  });
  it("doesn't match inside other words", () => {
    expect(matchHidePhrases("our impersonal calling plan", P)).toEqual([]);
  });
  it("several phrases can match", () => {
    expect(matchHidePhrases("personal call, and off the record", P).map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});
