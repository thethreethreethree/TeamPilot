import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/care/widget/bootstrap — the PUBLIC, no-auth entry the embedded widget calls on load. Two route-
 * level guarantees were untested (the widget-safe PROJECTION itself is separately locked by
 * config.widgetSafe.test.ts): (1) the input bound — a past audit found the embed token was passed downstream
 * with no length check, so a >64-char token must be rejected 400 BEFORE any tenant lookup; (2) the security
 * branch — an origin-rejected request gets 403 (distinct from a not-found 404), the anti-embedding control.
 * resolveCareTenantByEmbedToken + toWidgetSafeConfig are mocked; the route's own branching is the real code.
 */
vi.mock("@/lib/care/config", () => ({
  resolveCareTenantByEmbedToken: vi.fn(),
  toWidgetSafeConfig: vi.fn((c: unknown) => ({ agentName: (c as { agentName?: string }).agentName ?? "Jeff" })),
}));

import { resolveCareTenantByEmbedToken } from "@/lib/care/config";
import { GET } from "../route";

const resolver = resolveCareTenantByEmbedToken as unknown as ReturnType<typeof vi.fn>;

const req = (token: string | null, origin?: string) =>
  ({
    nextUrl: { searchParams: new URLSearchParams(token === null ? "" : `token=${encodeURIComponent(token)}`) },
    headers: { get: (k: string) => (k === "origin" && origin ? origin : null) },
  }) as unknown as Parameters<typeof GET>[0];

beforeEach(() => vi.clearAllMocks());

describe("GET /api/care/widget/bootstrap", () => {
  it("400 with no token — never hits the resolver", async () => {
    expect((await GET(req(null))).status).toBe(400);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("400 for an over-long token BEFORE any tenant lookup (locks the past audit input-bound fix)", async () => {
    const res = await GET(req("a".repeat(65)));
    expect(res.status).toBe(400);
    expect(resolver).not.toHaveBeenCalled(); // bounded before the DB lookup
  });

  it("403 when the origin is rejected (anti-embedding control, distinct from not-found)", async () => {
    resolver.mockResolvedValue({ ok: false, reason: "origin_rejected" });
    const res = await GET(req("a".repeat(32), "https://evil.example"));
    expect(res.status).toBe(403);
  });

  it("404 when the token resolves to no tenant (reason not origin_rejected)", async () => {
    resolver.mockResolvedValue({ ok: false, reason: "not_found" });
    expect((await GET(req("a".repeat(32)))).status).toBe(404);
  });

  it("200 returns only the widget-safe projection on success", async () => {
    resolver.mockResolvedValue({ ok: true, config: { agentName: "Ava", embed_token: "SECRET", plan: "pro" } });
    const res = await GET(req("a".repeat(32), "https://customer.example"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; widget: Record<string, unknown> };
    expect(body.ok).toBe(true);
    // The response carries the projected widget config, never the raw internal fields.
    expect(body.widget).toEqual({ agentName: "Ava" });
    expect(JSON.stringify(body)).not.toContain("SECRET"); // embed_token never leaves this unauthenticated route
  });
});
