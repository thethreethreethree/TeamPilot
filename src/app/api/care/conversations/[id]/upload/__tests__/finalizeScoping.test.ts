import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Direct-to-storage FINALIZE branch of the customer upload route (F2 — port off the ~4.5 MB Vercel body
 * cap). The browser PUTs bytes straight to Storage via /upload/sign, then POSTs { storagePath } here. Because
 * getAssetObjectInfo uses the ADMIN client (RLS bypass), the storagePath is UNTRUSTED caller input — so this
 * locks the two gates that stand between an attacker-supplied path and an admin-scoped read:
 *   1. the companyId-prefix check (a finalize can't be pointed at ANOTHER company's object), and
 *   2. re-validation against the REAL stored object (a browser that lied at sign time can't smuggle a
 *      too-large / disallowed file in via the finalize by claiming a nice type).
 * Same class as the Sales-Coach recording finalize (audit F1). Regressable independently of that route.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/data/care", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCareConversationByToken: vi.fn(),
    postCustomerMessage: vi.fn(async () => ({ id: "msg-1" })),
  };
});
vi.mock("@/lib/data/files", () => ({
  createFileRecord: vi.fn(async () => ({
    id: "file-1",
    title: "photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 6_000_000,
  })),
}));
vi.mock("@/lib/data/assetEvents", () => ({ emitAssetEvent: vi.fn(async () => {}) }));
// Partial-mock storage: keep the REAL validateUploadCandidate (the gate under test) and override only
// getAssetObjectInfo (the storage read) so we can drive the "real stored object" per case.
vi.mock("@/lib/storage/assets", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getAssetObjectInfo: vi.fn() };
});

import { POST } from "@/app/api/care/conversations/[id]/upload/route";
import { getCareConversationByToken } from "@/lib/data/care";
import { createFileRecord } from "@/lib/data/files";
import { getAssetObjectInfo } from "@/lib/storage/assets";

const COMPANY = "company-A";

const jsonReq = (token: string, body: unknown) =>
  ({
    headers: {
      get: (k: string) => {
        if (k === "x-care-session") return token;
        if (k === "content-type") return "application/json";
        return null;
      },
    },
    json: async () => body,
  }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCareConversationByToken).mockResolvedValue({
    id: "conv-1",
    status: "open",
    companyId: COMPANY,
  } as never);
});

describe("POST customer upload — direct-to-storage finalize gates", () => {
  it("403 when storagePath belongs to ANOTHER company — never reads it, never records it", async () => {
    const res = await POST(
      jsonReq("tok", { storagePath: "company-B/2026/08/evil.jpg", filename: "evil.jpg" }),
      ctx("conv-1")
    );
    expect(res.status).toBe(403);
    // The cross-company path is rejected by construction BEFORE the admin storage read.
    expect(getAssetObjectInfo).not.toHaveBeenCalled();
    expect(createFileRecord).not.toHaveBeenCalled();
  });

  it("400 missing storagePath", async () => {
    const res = await POST(jsonReq("tok", { filename: "x.jpg" }), ctx("conv-1"));
    expect(res.status).toBe(400);
  });

  it("404 when the object isn't in storage", async () => {
    vi.mocked(getAssetObjectInfo).mockResolvedValue(null);
    const res = await POST(
      jsonReq("tok", { storagePath: `${COMPANY}/2026/08/x.jpg`, filename: "x.jpg" }),
      ctx("conv-1")
    );
    expect(res.status).toBe(404);
    expect(createFileRecord).not.toHaveBeenCalled();
  });

  it("400 when the REAL stored object is disallowed (browser lied at sign time)", async () => {
    // Real stored content-type is an executable — the customer allow-list is images/pdf only.
    vi.mocked(getAssetObjectInfo).mockResolvedValue({
      sizeBytes: 3_000_000,
      contentType: "application/x-msdownload",
    });
    const res = await POST(
      jsonReq("tok", { storagePath: `${COMPANY}/2026/08/evil.exe`, filename: "evil.exe" }),
      ctx("conv-1")
    );
    expect(res.status).toBe(400);
    expect(createFileRecord).not.toHaveBeenCalled();
  });

  it("400 when the REAL stored object exceeds the 10 MB customer cap", async () => {
    vi.mocked(getAssetObjectInfo).mockResolvedValue({
      sizeBytes: 20 * 1024 * 1024,
      contentType: "image/jpeg",
    });
    const res = await POST(
      jsonReq("tok", { storagePath: `${COMPANY}/2026/08/big.jpg`, filename: "big.jpg" }),
      ctx("conv-1")
    );
    expect(res.status).toBe(400);
    expect(createFileRecord).not.toHaveBeenCalled();
  });

  it("attaches a valid, in-company image re-read from storage (happy path)", async () => {
    vi.mocked(getAssetObjectInfo).mockResolvedValue({
      sizeBytes: 6_000_000,
      contentType: "image/jpeg",
    });
    const res = await POST(
      jsonReq("tok", { storagePath: `${COMPANY}/2026/08/photo.jpg`, filename: "photo.jpg" }),
      ctx("conv-1")
    );
    expect(res.status).toBe(200);
    // The record is created with the REAL stored size/type, not the client's claim.
    expect(createFileRecord).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(createFileRecord).mock.calls[0]![0];
    expect(arg.sizeBytes).toBe(6_000_000);
    expect(arg.mimeType).toBe("image/jpeg");
    expect(arg.storagePath).toBe(`${COMPANY}/2026/08/photo.jpg`);
  });
});
