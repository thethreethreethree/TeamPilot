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

import { POST, sanitizeSourceUrl } from "@/app/api/care/extension/rcd/route";
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

  it("degrades to 503 (not 500) when 0194 isn't applied — Postgres 42P01 (A34)", async () => {
    vi.mocked(readBody).mockResolvedValue({
      channel: "gmail",
      messages: [{ seq: 0, role: "customer", text: "hi", media: [] }],
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdmin({ convError: { code: "42P01", message: 'relation "care_rcd_conversations" does not exist' } }) as never);
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("degrades to 503 for PostgREST's missing-table shape too (PGRST205 / schema cache) — the real Supabase error", async () => {
    // Regression: content.js writes go through PostgREST, which reports a missing table as PGRST205
    // ('Could not find the table … in the schema cache') — NOT 42P01. The founder hit this live and got
    // a generic 500 ('Couldn't start the capture.') instead of the honest 'apply the migration' message.
    vi.mocked(readBody).mockResolvedValue({
      channel: "whatsapp",
      messages: [{ seq: 0, role: "customer", text: "hi", media: [] }],
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdmin({
        convError: { code: "PGRST205", message: "Could not find the table 'public.care_rcd_conversations' in the schema cache" },
      }) as never
    );
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/isn't enabled|pending migration/i);
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

describe("sanitizeSourceUrl — stored source URLs are http(s) only (safe by construction)", () => {
  it("keeps http/https URLs", () => {
    expect(sanitizeSourceUrl("https://web.whatsapp.com/")).toBe("https://web.whatsapp.com/");
    expect(sanitizeSourceUrl("http://mail.google.com/x")).toBe("http://mail.google.com/x");
  });

  it("nulls dangerous or non-http schemes (javascript:, data:, vbscript:, file:)", () => {
    for (const u of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox",
      "file:///etc/passwd",
    ]) {
      expect(sanitizeSourceUrl(u), `should null: ${u}`).toBeNull();
    }
  });

  it("nulls non-URLs and empty/absent values", () => {
    expect(sanitizeSourceUrl("not a url")).toBeNull();
    expect(sanitizeSourceUrl("")).toBeNull();
    expect(sanitizeSourceUrl(null)).toBeNull();
    expect(sanitizeSourceUrl(undefined)).toBeNull();
    expect(sanitizeSourceUrl(123)).toBeNull();
  });

  it("nulls a PROTOCOL-RELATIVE url (//host) — a distinct vector the scheme cases miss", () => {
    // `//evil.com` has no scheme, so it isn't caught by the dangerous-scheme test above; new URL()
    // rejects it without a base, so it nulls. Matters because a scheme-relative link resolves to the
    // AMBIENT protocol if ever used as an href base — this locks that it can never be stored.
    expect(sanitizeSourceUrl("//evil.com/x")).toBeNull();
    expect(sanitizeSourceUrl("///evil.com")).toBeNull();
  });

  it("nulls a dangerous scheme regardless of CASE or leading whitespace (no normalization bypass)", () => {
    expect(sanitizeSourceUrl("JavaScript:alert(1)")).toBeNull();
    expect(sanitizeSourceUrl(" javascript:alert(1)")).toBeNull(); // URL() strips leading space, still javascript:
    expect(sanitizeSourceUrl("DATA:text/html,x")).toBeNull();
  });

  it("keeps an UPPERCASE http(s) scheme (a legitimate URL — protocol is case-insensitive)", () => {
    // Guards against an over-eager future 'reject unless lowercase https:' that would drop valid URLs.
    expect(sanitizeSourceUrl("HTTPS://ok.com/")).toBe("HTTPS://ok.com/");
  });

  it("truncates an over-long url to 4000 chars (bounded storage) without changing the scheme decision", () => {
    const long = "https://ok.com/" + "a".repeat(5000);
    const out = sanitizeSourceUrl(long);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(4000);
    expect(out!.startsWith("https://")).toBe(true);
  });
});
