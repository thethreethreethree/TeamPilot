import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * RCD ingest route (/api/care/extension/rcd) contract:
 *  - the extension gate runs BEFORE any DB write (rate-limit / entitlement short-circuit);
 *  - a capture with too many attachments is rejected (413) before touching the DB;
 *  - when 0194 isn't applied the missing table degrades to 503, not a 500 crash (A34);
 *  - the happy path creates the conversation + messages + media and returns a signed upload
 *    URL per media (the extension uploads bytes directly to the private bucket).
 * companyId always comes from the AUTHED user, never the request body (tenant isolation).
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn() }));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { POST } from "@/app/api/care/extension/rcd/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { createAdminClient } from "@/lib/supabase/admin";

const entitled = {
  ok: true,
  user: { userId: "agent-1", companyId: "co-1", entitlement: { status: "active", trialDaysLeft: 0, plan: "pro" } },
};
const req = {} as never;

// A flexible admin mock: conversations insert().select().single(); messages insert().select() awaited;
// media insert() awaited; storage.createSignedUploadUrl().
function makeAdmin(opts: { convError?: unknown } = {}) {
  const inserted: Record<string, unknown[]> = {};
  const admin = {
    from(table: string) {
      const builder = {
        _selected: false,
        _rows: null as unknown,
        insert(rows: unknown) {
          builder._rows = rows;
          inserted[table] = (inserted[table] ?? []).concat(rows as never);
          return builder;
        },
        select() {
          builder._selected = true;
          return builder;
        },
        async single() {
          if (table === "care_rcd_conversations") {
            if (opts.convError) return { data: null, error: opts.convError };
            return { data: { id: "conv-1" }, error: null };
          }
          return { data: null, error: null };
        },
        then(resolve: (v: unknown) => unknown) {
          if (table === "care_rcd_messages") {
            const rows = builder._rows as Array<{ seq: number }>;
            return Promise.resolve({ data: rows.map((r, i) => ({ id: `msg-${i}`, seq: r.seq })), error: null }).then(
              resolve
            );
          }
          return Promise.resolve({ error: null }).then(resolve); // media insert
        },
      };
      return builder;
    },
    storage: {
      from() {
        return {
          async createSignedUploadUrl(path: string) {
            return { data: { signedUrl: `https://storage/upload/${path}`, token: "tok" }, error: null };
          },
        };
      },
    },
    _inserted: inserted,
  };
  return admin;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
  vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
});

describe("POST /api/care/extension/rcd", () => {
  it("rate-limit short-circuits BEFORE any DB write", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("unentitled caller (402) is turned away before any DB write", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a capture with too many attachments (413) before touching the DB", async () => {
    vi.mocked(readBody).mockResolvedValue({
      channel: "whatsapp",
      messages: [{ seq: 0, role: "customer", text: "hi", media: Array.from({ length: 201 }, (_, i) => ({ ref: `m${i}`, type: "image" })) }],
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("degrades to 503 (not 500) when 0194 isn't applied — missing table (A34)", async () => {
    vi.mocked(readBody).mockResolvedValue({
      channel: "gmail",
      messages: [{ seq: 0, role: "customer", text: "hi", media: [] }],
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdmin({ convError: { code: "42P01", message: 'relation "care_rcd_conversations" does not exist' } }) as never);
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("happy path: creates rows + returns a signed upload URL per media; company from auth", async () => {
    vi.mocked(readBody).mockResolvedValue({
      channel: "whatsapp",
      sourceUrl: "https://web.whatsapp.com/",
      messages: [
        { seq: 0, role: "customer", sender: "Alice", text: "here's my receipt", media: [{ ref: "a0", type: "image", filename: "receipt.jpg" }] },
        { seq: 1, role: "agent", text: "thanks!", media: [] },
      ],
    } as never);
    const admin = makeAdmin();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversationId).toBe("conv-1");
    expect(json.uploads).toHaveLength(1);
    expect(json.uploads[0]).toMatchObject({ ref: "a0", signedUrl: expect.stringContaining("co-1/conv-1/") });

    // company_id on every inserted row is the AUTHED company, never client-supplied.
    const conv = admin._inserted["care_rcd_conversations"]![0] as { company_id: string; captured_by: string };
    expect(conv.company_id).toBe("co-1");
    expect(conv.captured_by).toBe("agent-1");
    const media = admin._inserted["care_rcd_media"]![0] as { company_id: string; storage_path: string };
    expect(media.company_id).toBe("co-1");
    expect(media.storage_path).toContain("co-1/conv-1/");
  });
});
