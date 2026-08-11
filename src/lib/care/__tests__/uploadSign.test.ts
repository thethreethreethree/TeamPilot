import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * mintCareUploadTarget is the shared validate → mint → response tail for BOTH C.A.R.E `…/sign` endpoints
 * (customer + agent). It runs AFTER each endpoint's own auth + conversation gate, so these tests lock the
 * parts it owns: the up-front validation rejects, and — critically — a mint failure returns a GENERIC message,
 * never the raw createSignedUploadTarget string (CWE-209). The real validateUploadCandidate is exercised (only
 * the mint primitive is mocked).
 */
vi.mock("@/lib/storage/assets", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, createSignedUploadTarget: vi.fn() };
});

import { mintCareUploadTarget } from "@/lib/care/uploadSign";
import { createSignedUploadTarget } from "@/lib/storage/assets";

const req = (body: unknown) => ({ json: async () => body }) as never;
const call = (body: unknown, uploadedVia: "customer_widget" | "agent_dashboard" = "customer_widget") =>
  mintCareUploadTarget({ req: req(body), companyId: "company-A", uploadedVia, logTag: "test/sign" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createSignedUploadTarget).mockResolvedValue({
    ok: true,
    storagePath: "company-A/2026/08/uuid.jpg",
    token: "tok",
  } as never);
});

describe("mintCareUploadTarget", () => {
  it("400 when filename is missing — never mints", async () => {
    const res = await call({ sizeBytes: 100, mimeType: "image/jpeg" });
    expect(res.status).toBe(400);
    expect(createSignedUploadTarget).not.toHaveBeenCalled();
  });

  it("400 when the claimed size is 0 / absent", async () => {
    expect((await call({ filename: "a.jpg", sizeBytes: 0, mimeType: "image/jpeg" })).status).toBe(400);
    expect((await call({ filename: "a.jpg", mimeType: "image/jpeg" })).status).toBe(400);
  });

  it("400 when the claimed type is disallowed for the lane (real validateUploadCandidate)", async () => {
    // customer_widget allows images/pdf only — an executable is rejected up front.
    const res = await call({ filename: "evil.exe", sizeBytes: 100, mimeType: "application/x-msdownload" });
    expect(res.status).toBe(400);
    expect(createSignedUploadTarget).not.toHaveBeenCalled();
  });

  it("mints under the passed (server-derived) companyId on a valid claim", async () => {
    const res = await call({ filename: "photo.jpg", sizeBytes: 100, mimeType: "image/jpeg" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ storagePath: "company-A/2026/08/uuid.jpg", token: "tok" });
    expect(vi.mocked(createSignedUploadTarget).mock.calls[0]![0].companyId).toBe("company-A");
  });

  it("returns a GENERIC 500 on a mint failure — not the raw backend string (CWE-209)", async () => {
    const secret = "Storage bucket 'assets-v1' does not exist. Create it via the Supabase Dashboard.";
    vi.mocked(createSignedUploadTarget).mockResolvedValue({ ok: false, error: secret } as never);
    const res = await call({ filename: "photo.jpg", sizeBytes: 100, mimeType: "image/jpeg" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("Supabase");
    expect(body.error).not.toContain("bucket");
    expect(body.error).toBe("Couldn't start the upload right now — please try again in a moment.");
  });
});
