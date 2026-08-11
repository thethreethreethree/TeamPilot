import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Direct-to-storage FINALIZE branch of the AGENT upload route (F2 — port off the ~4.5 MB Vercel body cap).
 * Same class as the customer route's finalizeScoping test and the Sales-Coach recording finalize (audit F1):
 * getAssetObjectInfo uses the ADMIN client, so the caller-supplied storagePath is untrusted. This locks the
 * companyId-prefix gate — an agent can't finalize a path pointed at ANOTHER company's object — and the
 * re-validation against the REAL stored object.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/data/care", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fetchAgentConversation: vi.fn(),
    postAgentMessage: vi.fn(async () => ({ id: "msg-1" })),
  };
});
vi.mock("@/lib/data/files", () => ({
  createFileRecord: vi.fn(async () => ({
    id: "file-1",
    title: "scan.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8_000_000,
  })),
  classifyFile: vi.fn(async () => {}),
}));
vi.mock("@/lib/data/assetEvents", () => ({ emitAssetEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/files/autoRoute", () => ({
  autoRouteFile: vi.fn(async () => ({
    title: null,
    description: null,
    departmentIds: [],
    taskIds: [],
    tags: [],
    ruleTrace: [],
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: () => ({ insert: async () => {} }) })) }));
vi.mock("@/lib/storage/assets", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getAssetObjectInfo: vi.fn() };
});

import { POST } from "@/app/api/care/conversations/[id]/agent-upload/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchAgentConversation } from "@/lib/data/care";
import { createFileRecord } from "@/lib/data/files";
import { getAssetObjectInfo } from "@/lib/storage/assets";

const COMPANY = "company-A";

const jsonReq = (body: unknown) =>
  ({
    headers: { get: (k: string) => (k === "content-type" ? "application/json" : null) },
    json: async () => body,
  }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireCareAgent).mockResolvedValue({
    ok: true,
    companyId: COMPANY,
    agentId: "agent-1",
  } as never);
  vi.mocked(fetchAgentConversation).mockResolvedValue({
    conversation: { companyId: COMPANY },
  } as never);
});

describe("POST agent upload — direct-to-storage finalize gates", () => {
  it("403 when storagePath belongs to ANOTHER company — never reads it, never records it", async () => {
    const res = await POST(
      jsonReq({ storagePath: "company-B/2026/08/evil.pdf", filename: "evil.pdf" }),
      ctx("conv-1")
    );
    expect(res.status).toBe(403);
    expect(getAssetObjectInfo).not.toHaveBeenCalled();
    expect(createFileRecord).not.toHaveBeenCalled();
  });

  it("404 when the object isn't in storage", async () => {
    vi.mocked(getAssetObjectInfo).mockResolvedValue(null);
    const res = await POST(
      jsonReq({ storagePath: `${COMPANY}/2026/08/x.pdf`, filename: "x.pdf" }),
      ctx("conv-1")
    );
    expect(res.status).toBe(404);
    expect(createFileRecord).not.toHaveBeenCalled();
  });

  it("400 when the REAL stored object exceeds the 25 MB agent cap", async () => {
    vi.mocked(getAssetObjectInfo).mockResolvedValue({
      sizeBytes: 40 * 1024 * 1024,
      contentType: "application/pdf",
    });
    const res = await POST(
      jsonReq({ storagePath: `${COMPANY}/2026/08/big.pdf`, filename: "big.pdf" }),
      ctx("conv-1")
    );
    expect(res.status).toBe(400);
    expect(createFileRecord).not.toHaveBeenCalled();
  });

  it("attaches a valid, in-company PDF re-read from storage (happy path)", async () => {
    vi.mocked(getAssetObjectInfo).mockResolvedValue({
      sizeBytes: 8_000_000,
      contentType: "application/pdf",
    });
    const res = await POST(
      jsonReq({ storagePath: `${COMPANY}/2026/08/scan.pdf`, filename: "scan.pdf" }),
      ctx("conv-1")
    );
    expect(res.status).toBe(200);
    expect(createFileRecord).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(createFileRecord).mock.calls[0]![0];
    expect(arg.sizeBytes).toBe(8_000_000);
    expect(arg.mimeType).toBe("application/pdf");
  });
});
