import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * loadUserContext memoizes the current user's identity as a single in-flight Promise. The subtle, bug-prone
 * properties (caching always is): concurrent first-callers dedupe to ONE fetch; a cache HIT does zero round
 * trips; and a FAILED load clears the cache so the next call retries cleanly rather than returning a rejected
 * promise forever. Untested until now.
 */

const state = vi.hoisted(() => ({
  enabled: true,
  user: { id: "u1", email: "e@x.co" } as { id: string; email: string | null } | null,
  profile: { company_id: "c1", full_name: "Nadia" } as { company_id: string | null; full_name: string | null } | null,
  profileError: null as { message: string } | null,
  getUser: vi.fn(),
  profileRead: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  get supabaseEnabled() {
    return state.enabled;
  },
  createClient: () => ({
    auth: {
      getUser: async () => {
        state.getUser();
        return { data: { user: state.user } };
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = async () => {
        state.profileRead();
        return { data: state.profile, error: state.profileError };
      };
      return b;
    },
  }),
}));

const { loadUserContext, clearUserContext } = await import("../userContext");

beforeEach(() => {
  clearUserContext();
  state.enabled = true;
  state.user = { id: "u1", email: "e@x.co" };
  state.profile = { company_id: "c1", full_name: "Nadia" };
  state.profileError = null;
  state.getUser.mockReset();
  state.profileRead.mockReset();
});

describe("loadUserContext", () => {
  it("throws in demo mode (live-mode only)", async () => {
    state.enabled = false;
    await expect(loadUserContext()).rejects.toThrow(/live-mode only/);
  });

  it("resolves the identity from auth + profile", async () => {
    await expect(loadUserContext()).resolves.toEqual({
      userId: "u1",
      companyId: "c1",
      fullName: "Nadia",
      email: "e@x.co",
    });
  });

  it("a cache HIT does zero extra round trips", async () => {
    await loadUserContext();
    await loadUserContext();
    expect(state.getUser).toHaveBeenCalledTimes(1);
    expect(state.profileRead).toHaveBeenCalledTimes(1);
  });

  it("concurrent first-callers dedupe to ONE fetch (same promise)", async () => {
    const [a, b] = await Promise.all([loadUserContext(), loadUserContext()]);
    expect(state.getUser).toHaveBeenCalledTimes(1);
    expect(a).toBe(b); // same resolved object
  });

  it("a failed load clears the cache so the next call RETRIES", async () => {
    state.user = null;
    await expect(loadUserContext()).rejects.toThrow(/Not signed in/);
    // fix the session and retry — must refetch, not return the cached rejection
    state.user = { id: "u1", email: "e@x.co" };
    await expect(loadUserContext()).resolves.toMatchObject({ userId: "u1" });
    expect(state.getUser).toHaveBeenCalledTimes(2);
  });

  it("throws (and doesn't cache) when the profile has no company", async () => {
    state.profile = { company_id: null, full_name: "x" };
    await expect(loadUserContext()).rejects.toThrow(/no company/);
    // cache cleared → a second attempt tries again
    await expect(loadUserContext()).rejects.toThrow(/no company/);
    expect(state.getUser).toHaveBeenCalledTimes(2);
  });

  it("clearUserContext forces a refetch", async () => {
    await loadUserContext();
    clearUserContext();
    await loadUserContext();
    expect(state.getUser).toHaveBeenCalledTimes(2);
  });
});
