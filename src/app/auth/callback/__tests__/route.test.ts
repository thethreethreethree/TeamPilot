import { describe, it, expect, vi, beforeEach } from "vitest";

const exchange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: exchange } }) }));
vi.mock("@/lib/siteUrl", () => ({ siteUrl: () => "https://elostate.com" }));
import { GET } from "../route";

const get = (qs: string) => GET(new Request(`https://preview-xyz.vercel.app/auth/callback${qs}`) as never);

beforeEach(() => exchange.mockReset());

describe("GET /auth/callback", () => {
  it("a good code signs in and lands on the requested same-site page, on the canonical origin", async () => {
    exchange.mockResolvedValue({ error: null });
    const res = await get("?code=abc&next=/dashboard/sales-coach");
    expect(exchange).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe("https://elostate.com/dashboard/sales-coach");
  });
  it("an off-site next is ignored (no open redirect)", async () => {
    exchange.mockResolvedValue({ error: null });
    expect((await get("?code=abc&next=//evil.example.com")).headers.get("location")).toBe("https://elostate.com/dashboard");
  });
  it("cancel, missing code, and a failed exchange go back to /login with a code, never free text", async () => {
    expect((await get("?error=access_denied&error_description=hi")).headers.get("location")).toBe("https://elostate.com/login?error=oauth_cancelled");
    expect((await get("")).headers.get("location")).toBe("https://elostate.com/login?error=oauth_incomplete");
    vi.spyOn(console, "error").mockImplementation(() => {});
    exchange.mockResolvedValue({ error: { message: "bad code" } });
    expect((await get("?code=zzz")).headers.get("location")).toBe("https://elostate.com/login?error=oauth_failed");
  });
});
