import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/sales-session/extract — authz + the format boundary.
 *
 * The boundary these tests pin: only a Sales Coach MANAGER may upload a document, and only the
 * allowlisted document types are accepted (an executable or unknown type is rejected before any parse).
 * A regression that drops the manager gate would let any authenticated member run the extractor.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

type Profile = { role: string | null; company_id: string | null; sales_coach_role: string | null } | null;

const MANAGER: Profile = { role: "CEO", company_id: "co1", sales_coach_role: null };
const MEMBER: Profile = { role: "Member", company_id: "co1", sales_coach_role: null };

function fakeSb(opts: { user?: boolean; profile?: Profile }) {
  const { user = true, profile = MANAGER } = opts;
  return {
    auth: { getUser: async () => ({ data: { user: user ? { id: "u1" } : null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }),
    }),
  };
}
const setSb = (sb: unknown) => (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);

function fileReq(name: string, content: string) {
  const fd = new FormData();
  fd.append("file", new File([content], name, { type: "application/octet-stream" }));
  return { formData: async () => fd } as unknown as Parameters<typeof POST>[0];
}
function emptyReq() {
  return { formData: async () => new FormData() } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => vi.clearAllMocks());

describe("/api/coach/sales-session/extract authz + format boundary", () => {
  it("401 when unauthenticated", async () => {
    setSb(fakeSb({ user: false }));
    expect((await POST(fileReq("m.txt", "hello"))).status).toBe(401);
  });

  it("403 for a non-manager member", async () => {
    setSb(fakeSb({ profile: MEMBER }));
    expect((await POST(fileReq("m.txt", "hello"))).status).toBe(403);
  });

  it("400 when no file is provided", async () => {
    setSb(fakeSb({ profile: MANAGER }));
    expect((await POST(emptyReq())).status).toBe(400);
  });

  it("415 rejects an unsupported/executable-ish type before parsing", async () => {
    setSb(fakeSb({ profile: MANAGER }));
    expect((await POST(fileReq("payload.doc", "x")).then((r) => r.status))).toBe(415);
    expect((await POST(fileReq("evil.exe", "MZ")).then((r) => r.status))).toBe(415);
  });

  it("200 extracts a supported .txt for a manager", async () => {
    setSb(fakeSb({ profile: MANAGER }));
    const res = await POST(fileReq("methodology.txt", "When they object, acknowledge first."));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.format).toBe("txt");
    expect(json.text).toContain("acknowledge first");
  });
});
