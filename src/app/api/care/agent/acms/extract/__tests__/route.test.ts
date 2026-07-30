import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/care/agent/acms/extract — authz + the format boundary. Only a C.A.R.E ADMIN may extract a
 * document; only allowlisted document types are accepted. A regression dropping the admin gate would let
 * any authenticated agent run the extractor on arbitrary uploads.
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));

import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { POST } from "../route";

const setAuth = (a: unknown) =>
  (requireCareAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(a);

const ADMIN = { ok: true, isAdmin: true, companyId: "co1", agentId: "a1" };
const AGENT = { ok: true, isAdmin: false, companyId: "co1", agentId: "a2" };

function fileReq(name: string, content: string, maxChars?: number) {
  const fd = new FormData();
  fd.append("file", new File([content], name, { type: "application/octet-stream" }));
  if (maxChars !== undefined) fd.append("maxChars", String(maxChars));
  return { formData: async () => fd } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => vi.clearAllMocks());

describe("/api/care/agent/acms/extract authz + format", () => {
  it("401 when unauthenticated", async () => {
    setAuth({ ok: false, error: "no", status: 401 });
    expect((await POST(fileReq("k.txt", "hi"))).status).toBe(401);
  });

  it("403 for a non-admin agent", async () => {
    setAuth(AGENT);
    expect((await POST(fileReq("k.txt", "hi"))).status).toBe(403);
  });

  it("415 rejects an unsupported type before parsing", async () => {
    setAuth(ADMIN);
    expect((await POST(fileReq("legacy.doc", "x"))).status).toBe(415);
  });

  it("200 extracts a supported .txt for an admin", async () => {
    setAuth(ADMIN);
    const res = await POST(fileReq("faqs.txt", "Our hours are 9-5."));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.format).toBe("txt");
    expect(json.text).toContain("9-5");
  });

  it("F5: honors the per-field maxChars so an upload can't exceed the target field's cap", async () => {
    // The guidance/product fields are 8k, not the 200k ceiling. A regression dropping the maxChars
    // plumbing would let a large upload overflow those fields (Save would then reject it).
    setAuth(ADMIN);
    const long = "word ".repeat(50); // 250 chars
    const res = await POST(fileReq("guidance.txt", long, 40));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.text.length).toBeLessThanOrEqual(40);
    expect(json.truncated).toBe(true);
  });
});
