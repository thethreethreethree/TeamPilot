import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET/POST /api/coach/sales-session/macro-mode.
 *
 * Founder report, 2026-09-24: "macro mode button of the website is broken."
 *
 * The route had no tests and one defect that produces exactly that experience without appearing
 * anywhere: `.update().eq()` with only `error` checked. A write matching ZERO rows — an RLS filter
 * declining it, a missing profile row — returns no error and no row count, so the route answered
 * `{ enabled: true }` either way. The toggle flips, the optimistic state sticks because the
 * response was ok, and the setting is back off on the next load.
 *
 * These pin the difference between "saved" and "reported saved". They do NOT prove the founder's
 * instance was this cause — that is unconfirmed, and the fix's real value is that the next
 * occurrence is visible in a log instead of silent.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => DB) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));

import { GET, POST } from "../route";

let updateResult: { data: unknown; error: unknown } = { data: { macro_mode_enabled: true }, error: null };
let selectResult: { data: unknown } = { data: { macro_mode_enabled: false } };
let user: { id: string } | null = { id: "rep1" };
let patched: Record<string, unknown> = {};

const DB = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: () => {
    const chain: Record<string, unknown> = {};
    let wrote = false;
    chain.select = () => chain;
    chain.update = (p: Record<string, unknown>) => {
      wrote = true;
      patched = p;
      return chain;
    };
    chain.eq = () => chain;
    chain.maybeSingle = async () => (wrote ? updateResult : selectResult);
    return chain;
  },
};

const req = (body?: unknown) =>
  ({ json: async () => body ?? { enabled: true } }) as never;

beforeEach(() => {
  user = { id: "rep1" };
  patched = {};
  updateResult = { data: { macro_mode_enabled: true }, error: null };
  selectResult = { data: { macro_mode_enabled: false } };
});

describe("reading the flag", () => {
  it("reports what the profile holds", async () => {
    selectResult = { data: { macro_mode_enabled: true } };
    expect(await (await GET(req())).json()).toEqual({ enabled: true });
  });

  it("reports false — not an error — when the profile has no value yet", async () => {
    selectResult = { data: null };
    expect(await (await GET(req())).json()).toEqual({ enabled: false });
  });

  it("refuses an unauthenticated read", async () => {
    user = null;
    expect((await GET(req())).status).toBe(401);
  });
});

describe("a write that does not land is not a success", () => {
  it("500s when the update matches ZERO rows", async () => {
    // THE REPORTED BUG'S SHAPE. No error, no row — RLS declined it or the profile is missing.
    // The old route returned 200 here and the button appeared to work until the next reload.
    updateResult = { data: null, error: null };
    const res = await POST(req({ enabled: true }));
    expect(res.status).toBe(500);
  });

  it("does not echo the requested value back when nothing was written", async () => {
    updateResult = { data: null, error: null };
    const body = (await (await POST(req({ enabled: true }))).json()) as Record<string, unknown>;
    // `{ enabled: true }` here is the lie: it is the caller's own input, not a stored fact.
    expect(body.enabled).toBeUndefined();
  });

  it("answers with the STORED value, not the requested one", async () => {
    // If the two ever disagree, the database is right and the client needs to know.
    updateResult = { data: { macro_mode_enabled: false }, error: null };
    const body = (await (await POST(req({ enabled: true }))).json()) as { enabled: boolean };
    expect(body.enabled).toBe(false);
  });

  it("500s on a database error without leaking it (CWE-209)", async () => {
    updateResult = { data: null, error: { message: 'relation "profiles" violates policy p_xyz' } };
    const res = await POST(req({ enabled: true }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/policy|relation/i);
  });
});

describe("what it writes", () => {
  it("sets the flag the caller asked for", async () => {
    await POST(req({ enabled: true }));
    expect(patched).toEqual({ macro_mode_enabled: true });
  });

  it("refuses a body that is not a boolean", async () => {
    const res = await POST(req({ enabled: "yes" }));
    expect(res.status).toBe(400);
  });

  it("refuses an unauthenticated write", async () => {
    user = null;
    expect((await POST(req({ enabled: true }))).status).toBe(401);
  });
});
