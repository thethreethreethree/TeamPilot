import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * callerCompanyId — the cookie-client class in its quietest form.
 *
 * `getCurrentCompanyId()` builds its OWN cookie client. A phone sends a Bearer token and no cookie, so it
 * resolves nobody and returns null, and the route answers 403 — an authenticated rep told they have no
 * company. It is indistinguishable from a real permission problem, in the response and in the log.
 *
 * Confirmed live against production on 2026-09-10, not inferred: a real Bearer token for a real rep, on
 * their own two-sided session, got {"error":"No company context."} from attribute-unlabelled. Four routes
 * already carried this fallback inline; two did not, and those two were the answer-whose-voice-this-is
 * flow and the recover-my-dropped-call button — the two things a rep reaches for when a call went wrong.
 */
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn() }));

import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { callerCompanyId } from "../callerCompanyId";

const mk = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

/** A client that answers one profiles row, recording what it was asked. */
function db(companyId: string | null, spy?: { table?: string; id?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (_col: string, val: unknown) => {
    if (spy) spy.id = val;
    return chain;
  };
  chain.maybeSingle = async () => ({ data: companyId === null ? null : { company_id: companyId } });
  return {
    from: (t: string) => {
      if (spy) spy.table = t;
      return chain;
    },
  } as unknown as Parameters<typeof callerCompanyId>[0];
}

beforeEach(() => vi.clearAllMocks());

describe("callerCompanyId", () => {
  it("uses the cookie session when there is one — the web path is unchanged", async () => {
    mk(getCurrentCompanyId).mockResolvedValue("co-web");
    const spy: { table?: string } = {};
    expect(await callerCompanyId(db("co-other", spy), "rep1")).toBe("co-web");
    expect(spy.table).toBeUndefined(); // no fallback read at all when the cookie answered
  });

  it("falls back to the caller's own profile row when there is NO cookie — the phone path", async () => {
    mk(getCurrentCompanyId).mockResolvedValue(null);
    const spy: { table?: string; id?: unknown } = {};
    expect(await callerCompanyId(db("co-mobile", spy), "rep1")).toBe("co-mobile");
    expect(spy.table).toBe("profiles");
    expect(spy.id).toBe("rep1"); // the CALLER's row, never anybody else's
  });

  it("returns undefined — not a wrong company — when neither path knows", async () => {
    mk(getCurrentCompanyId).mockResolvedValue(null);
    expect(await callerCompanyId(db(null), "rep1")).toBeUndefined();
  });

  it("reads through the client it is GIVEN, so RLS still decides", async () => {
    // The whole point: the fallback must not reach for an admin client to 'fix' the read. It asks the
    // caller's own scoped client, so a caller who may not see a row still does not see it.
    mk(getCurrentCompanyId).mockResolvedValue(null);
    const spy: { table?: string; id?: unknown } = {};
    await callerCompanyId(db("co1", spy), "rep-b");
    expect(spy.id).toBe("rep-b");
  });
});
