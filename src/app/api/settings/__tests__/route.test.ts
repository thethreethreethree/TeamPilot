import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PATCH /api/settings — company settings write. Previously untested. Pins the injection defense (a strict zod
 * schema + an ALLOWED_FIELDS allowlist — unknown fields like company_id can't be smuggled in), the auth gate,
 * the empty-patch 400, the provider enum, and the generic-500-no-leak (CWE-209). readBody + the schema are the
 * real implementations; only the company lookup + supabase client are faked.
 */
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { PATCH } from "../route";

const setCompany = (v: unknown) =>
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

const captured: { patch?: Record<string, unknown> } = {};
const setDb = (updateError: unknown = null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        captured.patch = patch;
        return { eq: async () => ({ error: updateError }) };
      },
    }),
  });

const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0];

beforeEach(() => {
  vi.clearAllMocks();
  captured.patch = undefined;
});

describe("PATCH /api/settings", () => {
  it("401 when there's no authenticated company", async () => {
    setCompany(null);
    setDb();
    expect((await PATCH(req({ name: "Acme" }))).status).toBe(401);
  });

  it("400 rejects an unknown field (strict schema — no company_id smuggling)", async () => {
    setCompany("co1");
    setDb();
    const res = await PATCH(req({ name: "Acme", company_id: "co-EVIL" }));
    expect(res.status).toBe(400);
    expect(captured.patch).toBeUndefined(); // never reached the write
  });

  it("400 rejects an invalid llm_provider_preference", async () => {
    setCompany("co1");
    setDb();
    expect((await PATCH(req({ llm_provider_preference: "openai" }))).status).toBe(400);
  });

  it("400 when no mutable fields are provided", async () => {
    setCompany("co1");
    setDb();
    expect((await PATCH(req({}))).status).toBe(400);
  });

  it("200 writes ONLY the allowlisted fields", async () => {
    setCompany("co1");
    setDb();
    const res = await PATCH(req({ name: "Acme", timezone: "UTC", llm_provider_preference: "deepseek" }));
    expect(res.status).toBe(200);
    expect(captured.patch).toEqual({ name: "Acme", timezone: "UTC", llm_provider_preference: "deepseek" });
  });

  it("500 without leaking the raw DB error (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setCompany("co1");
    setDb({ message: "internal pg detail: companies rls" });
    const res = await PATCH(req({ name: "Acme" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal pg detail");
  });
});
