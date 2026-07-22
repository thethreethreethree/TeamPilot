import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * guardExtensionRequest is the SINGLE security gate for all 6 extension tool endpoints, so its ORDER is
 * load-bearing: an unentitled or rate-limited caller must be turned away BEFORE body parsing / any paid compute.
 * The per-route tests exercise it in context; this locks the ordering directly in one place.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn() }));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));

import { guardExtensionRequest } from "../extensionGuard";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";

const Schema = z.object({ conversation: z.string() }).strict();
const entitled = { ok: true, user: { userId: "u", companyId: "c" } };
const req = {} as never;
const opts = { tool: "coach", perUserMax: 30, schema: Schema };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
});

describe("guardExtensionRequest — gate ordering", () => {
  it("pre-auth flood guard short-circuits BEFORE the auth gate + body", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    const r = await guardExtensionRequest(req, opts);
    expect(r.ok).toBe(false);
    expect(requireEntitledExtensionUser).not.toHaveBeenCalled();
    expect(readBody).not.toHaveBeenCalled();
  });

  it("unentitled (402) short-circuits BEFORE the per-user limit + body", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const r = await guardExtensionRequest(req, opts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(402);
    // pre-auth (1st rateLimit) ran; per-user (2nd) did NOT — auth failed first
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(readBody).not.toHaveBeenCalled();
  });

  it("per-user rate limit short-circuits BEFORE body parsing", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(rateLimit)
      .mockReturnValueOnce(null) // pre-auth passes
      .mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 })); // per-user trips
    const r = await guardExtensionRequest(req, opts);
    expect(r.ok).toBe(false);
    expect(readBody).not.toHaveBeenCalled();
  });

  it("uses the per-tool bucket id + max for the per-user limit", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(readBody).mockResolvedValue({ conversation: "x" } as never);
    await guardExtensionRequest(req, { tool: "spawn", perUserMax: 12, schema: Schema });
    // 2nd rateLimit call = the per-user limit
    expect(vi.mocked(rateLimit).mock.calls[1]?.[1]).toMatchObject({ id: "care-ext-spawn:u", max: 12 });
  });

  it("success → { ok, user, body }", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(readBody).mockResolvedValue({ conversation: "hello" } as never);
    const r = await guardExtensionRequest(req, opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.user.companyId).toBe("c");
      expect(r.body).toEqual({ conversation: "hello" });
    }
  });

  it("invalid body (readBody returns a NextResponse) → passed through as the guard response", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(readBody).mockResolvedValue(NextResponse.json({ error: "bad body" }, { status: 400 }) as never);
    const r = await guardExtensionRequest(req, opts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });
});
