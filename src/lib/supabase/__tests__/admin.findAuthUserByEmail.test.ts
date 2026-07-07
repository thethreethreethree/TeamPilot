import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression lock for the "wrong person is already a member of this company" bug
 * (founder-reported 2026-07-07): inviting `jankinz1401@gmail.com` claimed "Rebecca
 * Lupague is already a member." Root cause — GoTrue's admin list-users endpoint
 * does NOT filter by `?email=` on this instance; it returns the first page of ALL
 * users, and the old code took `users[0]` WITHOUT verifying its email, so every
 * lookup resolved to whoever sorts first in auth.users. The fix pages through and
 * matches the `email` field EXACTLY. These tests pin that: an exact match is
 * required, users[0] is never trusted, and a genuinely-new email returns null.
 * (Lesson: feedback_admin_users_email_filter — verify by the actual email field.)
 */
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

import { createClient } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "../admin";

function mockPages(
  pages: Array<Array<{ id: string; email: string | null }>>
) {
  let call = 0;
  const listUsers = vi.fn(async () => {
    const users = pages[call] ?? [];
    call += 1;
    return { data: { users }, error: null };
  });
  vi.mocked(createClient).mockReturnValue({
    auth: { admin: { listUsers } },
  } as never);
  return listUsers;
}

describe("findAuthUserByEmail — exact email match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns the EXACT-email match, not users[0] (the reported bug)", async () => {
    // The endpoint returns an unfiltered list; the target is NOT first. The old
    // code returned users[0] ('rebecca') for every lookup — this asserts it does
    // not.
    mockPages([
      [
        { id: "rebecca", email: "rebecca@lupague.com" },
        { id: "jan", email: "jankinz1401@gmail.com" },
      ],
    ]);
    expect(await findAuthUserByEmail("jankinz1401@gmail.com")).toEqual({
      id: "jan",
      email: "jankinz1401@gmail.com",
    });
  });

  it("returns null when NO user's email matches (a genuinely new invitee)", async () => {
    mockPages([
      [
        { id: "rebecca", email: "rebecca@lupague.com" },
        { id: "someone", email: "someone@else.com" },
      ],
    ]);
    expect(await findAuthUserByEmail("brand-new@nobody.com")).toBeNull();
  });

  it("matches case-insensitively and trims surrounding whitespace", async () => {
    mockPages([[{ id: "jan", email: "Jankinz1401@Gmail.com" }]]);
    expect(await findAuthUserByEmail("  jankinz1401@gmail.com ")).toEqual({
      id: "jan",
      email: "Jankinz1401@Gmail.com",
    });
  });

  it("pages past a full first page to find a later match (no page-1-only miss)", async () => {
    const fullPage = Array.from({ length: 200 }, (_, i) => ({
      id: `u${i}`,
      email: `u${i}@x.com`,
    }));
    mockPages([fullPage, [{ id: "jan", email: "jankinz1401@gmail.com" }]]);
    expect(await findAuthUserByEmail("jankinz1401@gmail.com")).toEqual({
      id: "jan",
      email: "jankinz1401@gmail.com",
    });
  });

  it("returns null (soft-fail, does not throw) when service-role env is absent", async () => {
    // no URL/key → cannot verify → allow the invite rather than 500
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await findAuthUserByEmail("anyone@x.com")).toBeNull();
  });
});
