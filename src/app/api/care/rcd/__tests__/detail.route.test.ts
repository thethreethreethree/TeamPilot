import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RCD detail route (/api/care/rcd/[id]) — the read the RCD panel/sheet hits when an agent opens a
 * capture. Verifies: 404 when the conversation isn't visible to the tenant (RLS yields nothing);
 * happy path groups each message's media under it and attaches a signed URL from the batch sign;
 * a media object with no bytes (the common pre-Phase-2c case) degrades to url:null (placeholder).
 */

vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));

import { GET } from "@/app/api/care/rcd/[id]/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

// Minimal RLS-client mock: .from(table).select().eq()[.order()|.maybeSingle()|await]; storage.createSignedUrls.
function makeSb(store: {
  conv: unknown;
  messages: unknown[];
  media: unknown[];
  signErrorPaths?: string[];
}) {
  return {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => Promise.resolve({ data: table === "care_rcd_messages" ? store.messages : [], error: null }),
        maybeSingle: () => Promise.resolve({ data: store.conv, error: null }),
        // media query is awaited directly after .eq() — make the builder thenable.
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: table === "care_rcd_media" ? store.media : [], error: null }).then(resolve),
      };
      return builder;
    },
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[]) =>
          Promise.resolve({
            data: paths.map((p) => ({
              path: p,
              signedUrl: store.signErrorPaths?.includes(p) ? "" : `https://storage/signed/${p}`,
              error: store.signErrorPaths?.includes(p) ? "not found" : null,
            })),
            error: null,
          }),
      }),
    },
  };
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/care/rcd/[id]", () => {
  it("401s when unauthenticated", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: false, error: "no", status: 401 } as never);
    const res = await GET(new Request("http://x"), ctx("c1"));
    expect(res.status).toBe(401);
  });

  it("404s when the conversation isn't visible to the tenant (RLS yields nothing)", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({
      ok: true,
      sb: makeSb({ conv: null, messages: [], media: [] }),
    } as never);
    const res = await GET(new Request("http://x"), ctx("other-tenant"));
    expect(res.status).toBe(404);
  });

  it("groups media under its message and attaches a signed URL", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({
      ok: true,
      sb: makeSb({
        conv: { id: "c1", channel: "whatsapp", message_count: 2, captured_at: "2026-07-26T00:00:00Z" },
        messages: [
          { id: "m0", seq: 0, role: "customer", sender: "Alice", body: "see attached" },
          { id: "m1", seq: 1, role: "agent", sender: null, body: "got it" },
        ],
        media: [
          { id: "med0", message_id: "m0", media_type: "image", storage_path: "co/c1/med0", filename: "a.jpg", alt: null, content_type: null, byte_size: null },
        ],
      }),
    } as never);
    const res = await GET(new Request("http://x"), ctx("c1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.messages).toHaveLength(2);
    expect(json.messages[0].media).toHaveLength(1);
    expect(json.messages[0].media[0].url).toBe("https://storage/signed/co/c1/med0");
    expect(json.messages[1].media).toHaveLength(0);
  });

  it("degrades a byte-less media object to url:null (placeholder), not a broken image", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({
      ok: true,
      sb: makeSb({
        conv: { id: "c1", channel: "gmail", message_count: 1, captured_at: "2026-07-26T00:00:00Z" },
        messages: [{ id: "m0", seq: 0, role: "customer", sender: null, body: "" }],
        media: [{ id: "med0", message_id: "m0", media_type: "image", storage_path: "co/c1/med0", filename: "x.png", alt: null, content_type: null, byte_size: null }],
        signErrorPaths: ["co/c1/med0"], // no bytes uploaded yet → sign fails
      }),
    } as never);
    const res = await GET(new Request("http://x"), ctx("c1"));
    const json = await res.json();
    expect(json.messages[0].media[0].url).toBeNull();
  });
});
