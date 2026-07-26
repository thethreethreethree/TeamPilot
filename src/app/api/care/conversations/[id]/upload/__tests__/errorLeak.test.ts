import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * No raw-exception leak on the PUBLIC customer upload endpoint (CWE-209).
 *
 * This was the WORST instance found 2026-07-27: it returned a raw DB error to the unauthenticated customer
 * AND had no server-side log at all. Independently regressable (its own catch), so it gets its own lock:
 * a file-row-write failure must return a GENERIC 500, never the raw exception. (`f188f791`.)
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/data/care", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getCareConversationByToken: vi.fn(), postCustomerMessage: vi.fn() };
});
vi.mock("@/lib/data/files", () => ({ createFileRecord: vi.fn() }));
vi.mock("@/lib/data/assetEvents", () => ({ emitAssetEvent: vi.fn() }));
vi.mock("@/lib/storage/assets", () => ({
  validateUploadCandidate: vi.fn(() => ({ ok: true })),
  buildStoragePath: vi.fn(() => "co-A/file-1/test.png"),
  uploadAssetBytes: vi.fn(async () => ({ ok: true })),
}));

import { POST } from "@/app/api/care/conversations/[id]/upload/route";
import { getCareConversationByToken } from "@/lib/data/care";
import { createFileRecord } from "@/lib/data/files";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const uploadReq = (token: string) => {
  const fd = new FormData();
  fd.append("file", new File(["bytes"], "test.png", { type: "image/png" }));
  return {
    headers: { get: (k: string) => (k === "x-care-session" ? token : null) },
    formData: async () => fd,
  } as never;
};

beforeEach(() => vi.clearAllMocks());

describe("POST customer upload — no raw-exception leak (CWE-209)", () => {
  it("a file-row-write failure returns a GENERIC 500 — raw DB error never reaches the customer", async () => {
    vi.mocked(getCareConversationByToken).mockResolvedValue({
      id: "conv-1",
      companyId: "co-A",
      status: "open",
    } as never);
    vi.mocked(createFileRecord).mockRejectedValue(
      new Error('relation "care_file_records_internal" does not exist')
    );
    const res = await POST(uploadReq("tok"), ctx("conv-1"));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("Failed to save the file. Please try again.");
    expect(JSON.stringify(json)).not.toContain("care_file_records_internal"); // no raw DB error in the response
  });
});
