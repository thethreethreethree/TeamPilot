import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/files/upload-url mints a SIGNED UPLOAD target — a bearer write-capability the moment it's issued, so
 * the gate here is the security boundary (per the signed-URL bearer-capability lens). This locks:
 *   1. auth is required (401 without a session), and
 *   2. the storage path's companyId comes from the SERVER auth context, never client input (no cross-company
 *      mint), and
 *   3. a mint failure returns a GENERIC message, not the raw createSignedUploadTarget error string (CWE-209 —
 *      the sibling …/sign endpoints already do this; this route was the un-updated instance).
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
// Keep the REAL validateUploadCandidate (the up-front gate); override only the mint primitive.
vi.mock("@/lib/storage/assets", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, createSignedUploadTarget: vi.fn() };
});

import { POST } from "@/app/api/files/upload-url/route";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { createSignedUploadTarget } from "@/lib/storage/assets";

const req = (body: unknown) => ({ json: async () => body }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentAuthContext).mockResolvedValue({
    userId: "user-1",
    companyId: "company-A",
    role: "member",
    isAdmin: false,
  } as never);
  vi.mocked(createSignedUploadTarget).mockResolvedValue({
    ok: true,
    storagePath: "company-A/2026/08/uuid.jpg",
    token: "tok",
  } as never);
});

describe("POST /api/files/upload-url — signed target mint gate", () => {
  it("401 when unauthenticated — never mints a target", async () => {
    vi.mocked(getCurrentAuthContext).mockResolvedValue(null as never);
    const res = await POST(req({ filename: "a.jpg", sizeBytes: 1000, mimeType: "image/jpeg" }));
    expect(res.status).toBe(401);
    expect(createSignedUploadTarget).not.toHaveBeenCalled();
  });

  it("mints under the caller's OWN companyId from auth (no client-supplied tenant)", async () => {
    const res = await POST(req({ filename: "a.jpg", sizeBytes: 1000, mimeType: "image/jpeg" }));
    expect(res.status).toBe(200);
    expect(createSignedUploadTarget).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(createSignedUploadTarget).mock.calls[0]![0];
    expect(arg.companyId).toBe("company-A");
  });

  it("returns a GENERIC message on mint failure — not the raw backend string (CWE-209)", async () => {
    const secret =
      "Storage bucket 'assets-v1' does not exist. Create it via Supabase Dashboard → Storage → New bucket.";
    vi.mocked(createSignedUploadTarget).mockResolvedValue({ ok: false, error: secret } as never);
    const res = await POST(req({ filename: "a.jpg", sizeBytes: 1000, mimeType: "image/jpeg" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("Supabase");
    expect(body.error).not.toContain("bucket");
    expect(body.error).toBe("Couldn't start the upload right now — please try again in a moment.");
  });
});
