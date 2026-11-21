import { describe, it, expect, vi } from "vitest";
import { signInViaServer } from "../signInViaServer";

/**
 * The login pages' sign-in (RSS Phase 0 step 7). The fallback rule is the whole point: our route failing must
 * never lock everyone out (2026-11-11), and a real answer from it (wrong password, locked) must never be
 * retried around by signing in directly.
 */
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function supabase(error: { message: string } | null = null) {
  const signInWithPassword = vi.fn(async () => ({ error }));
  return { client: { auth: { signInWithPassword } } as never, signInWithPassword };
}

describe("signInViaServer", () => {
  it("success through the route — the direct path is not used", async () => {
    const s = supabase();
    const f = vi.fn(async () => json(200, { ok: true }));
    expect(await signInViaServer(s.client, "a@b.co", "pw", f)).toBeNull();
    expect(f).toHaveBeenCalledWith("/api/auth/sign-in", expect.objectContaining({ method: "POST" }));
    expect(s.signInWithPassword).not.toHaveBeenCalled();
  });

  it("a wrong password (400) is shown as-is and NOT retried directly", async () => {
    const s = supabase();
    const msg = await signInViaServer(s.client, "a@b.co", "pw", async () => json(400, { error: "Invalid login credentials" }));
    expect(msg).toBe("Invalid login credentials");
    expect(s.signInWithPassword).not.toHaveBeenCalled();
  });

  it("a lockout (429) is final — never bypassed by the fallback", async () => {
    const s = supabase();
    const msg = await signInViaServer(s.client, "a@b.co", "pw", async () => json(429, { error: "Too many failed sign-ins.", locked: true }));
    expect(msg).toMatch(/Too many/);
    expect(s.signInWithPassword).not.toHaveBeenCalled();
  });

  it("our route failing (500) falls back to the direct sign-in, so login keeps working", async () => {
    const s = supabase();
    expect(await signInViaServer(s.client, "a@b.co", "pw", async () => json(500, { error: "x" }))).toBeNull();
    expect(s.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.co", password: "pw" });
  });

  it("an unreachable route falls back too, and the direct path's own error is shown", async () => {
    const s = supabase({ message: "Invalid login credentials" });
    const msg = await signInViaServer(s.client, "a@b.co", "pw", async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(msg).toBe("Invalid login credentials");
  });
});
