import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * No raw-exception leak on the PUBLIC create-conversation endpoint (CWE-209).
 *
 * Each customer route carries its own copy of the error handling, so it is independently regressable — the
 * messages-route test does NOT protect this one. An internal failure here must return a GENERIC 500, never
 * the raw exception (Postgres table/column names, missing-env-var names) to an unauthenticated customer.
 * Locks the 2026-07-27 fix (`f188f791`/`3e8c75ae`): the raw cause is console.error'd server-side only.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/care/config", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, resolveCareTenantByEmbedToken: vi.fn() };
});

import { POST } from "@/app/api/care/conversations/route";
import { resolveCareTenantByEmbedToken } from "@/lib/care/config";

const req = (body: unknown) =>
  ({ headers: { get: () => null }, json: async () => body }) as never;

beforeEach(() => vi.clearAllMocks());

describe("POST /api/care/conversations — no raw-exception leak (CWE-209)", () => {
  it("an internal error returns a GENERIC 500 — raw exception never reaches the customer", async () => {
    vi.mocked(resolveCareTenantByEmbedToken).mockRejectedValue(
      new Error('relation "support_conversations" does not exist')
    );
    const res = await POST(req({ embedToken: "tok-abc" }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error?: string; detail?: unknown };
    expect(json.error).toBe("Couldn't open a conversation.");
    expect(json.detail).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("support_conversations"); // no leak anywhere in the body
  });
});
