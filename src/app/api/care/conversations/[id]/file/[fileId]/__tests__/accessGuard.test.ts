import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Customer file-access guard on GET /api/care/conversations/[id]/file/[fileId]. Distinct from the plain
 * conversation IDOR check: even within a customer's OWN (token-authorized) conversation, they may only
 * download a file that is (a) linked to THAT conversation, and (b) access_role === 'everyone'. This stops
 * two real leaks: a file from another conversation, and an INTERNAL/admin-only file an agent attached to
 * the thread (customers must never pull an admins-only attachment via the inline link). Previously untested.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/data/care", () => ({ getCareConversationByToken: vi.fn() }));
vi.mock("@/lib/storage/assets", () => ({
  signAssetUrl: vi.fn(() => Promise.resolve("https://signed/url")),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { GET } from "@/app/api/care/conversations/[id]/file/[fileId]/route";
import { getCareConversationByToken } from "@/lib/data/care";
import { createAdminClient } from "@/lib/supabase/admin";

const req = (token?: string) =>
  ({ headers: { get: (k: string) => (k === "x-care-session" ? token ?? null : null) } }) as never;
const ctx = (id: string, fileId: string) => ({ params: Promise.resolve({ id, fileId }) });

// admin.from("files").select(...).eq("id",fileId).is("deprecated_at",null).maybeSingle() → { data }
const adminReturning = (data: unknown) => ({
  from: () => ({
    select: () => ({ eq: () => ({ is: () => ({ maybeSingle: () => Promise.resolve({ data }) }) }) }),
  }),
});

const fileRow = (over: Record<string, unknown>) => ({
  storage_path: "co/rec.png",
  title: "t",
  mime_type: "image/png",
  size_bytes: 1,
  linked_conversation_id: "conv-1",
  access_role: "everyone",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  // The token authorizes conv-1, and the caller asks for conv-1 (so the plain IDOR check passes and we
  // isolate the FILE guard).
  vi.mocked(getCareConversationByToken).mockResolvedValue({ id: "conv-1" } as never);
});

describe("GET customer file/[fileId] — access guard", () => {
  it("404 when the file belongs to ANOTHER conversation (linked_conversation_id mismatch)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      adminReturning(fileRow({ linked_conversation_id: "conv-OTHER" })) as never
    );
    expect((await GET(req("tok"), ctx("conv-1", "file-x"))).status).toBe(404);
  });

  it("404 when the file is INTERNAL (access_role !== 'everyone') — no downloading an admin-only attachment", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      adminReturning(fileRow({ access_role: "admins" })) as never
    );
    expect((await GET(req("tok"), ctx("conv-1", "file-x"))).status).toBe(404);
  });

  it("200 for an 'everyone' file linked to the customer's OWN conversation", async () => {
    vi.mocked(createAdminClient).mockReturnValue(adminReturning(fileRow({})) as never);
    const res = await GET(req("tok"), ctx("conv-1", "file-x"));
    expect(res.status).toBe(200);
    expect((await res.json()).downloadUrl).toBeTruthy();
  });
});
