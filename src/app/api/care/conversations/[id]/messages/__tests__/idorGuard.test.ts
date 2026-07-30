import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Customer IDOR guard on the widget messages endpoint — the single most important customer-facing security
 * property: a public x-care-session token holder can read/write ONLY their own conversation. The route
 * resolves the conversation from the token and requires `conversation.id === <URL id>`; swapping the URL id
 * to another customer's conversation must 404. This was previously untested (the sibling test covers only
 * the handoffCaptureNeeded helper). A regression that dropped the `conversation.id !== id` check would leak
 * every customer's conversation to any token holder — this locks it.
 *
 * The guard returns EARLY (before any message read / LLM), so we mock only the token resolver + rate limit,
 * and stub @/lib/claude so importing the route doesn't run llm/env validation.
 */
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/data/care", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getCareConversationByToken: vi.fn() };
});

import { GET, POST } from "@/app/api/care/conversations/[id]/messages/route";
import { getCareConversationByToken } from "@/lib/data/care";
import { generateCareReply } from "@/lib/claude";

const req = (token?: string) =>
  ({ headers: { get: (k: string) => (k === "x-care-session" ? token ?? null : null) } }) as never;
const postReq = (token: string) =>
  ({
    headers: { get: (k: string) => (k === "x-care-session" ? token : null) },
    json: async () => ({ body: "hello" }),
  }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/care/conversations/[id]/messages — customer IDOR guard", () => {
  it("401 with no session token (and never touches the DB)", async () => {
    const res = await GET(req(undefined), ctx("conv-1"));
    expect(res.status).toBe(401);
    expect(getCareConversationByToken).not.toHaveBeenCalled();
  });

  it("404 when the token resolves to a DIFFERENT conversation than the URL id — no cross-customer read", async () => {
    // A valid token for conv-OTHER, but the caller asks for conv-1 (id-swap attempt).
    vi.mocked(getCareConversationByToken).mockResolvedValue({ id: "conv-OTHER" } as never);
    const res = await GET(req("valid-token-for-another-conversation"), ctx("conv-1"));
    expect(res.status).toBe(404); // must NOT return conv-1's messages to a conv-OTHER token holder
  });

  it("404 when the token is invalid/expired (resolves to null)", async () => {
    vi.mocked(getCareConversationByToken).mockResolvedValue(null as never);
    const res = await GET(req("bogus-or-expired"), ctx("conv-1"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/care/conversations/[id]/messages — no raw-exception leak (CWE-209)", () => {
  it("an internal error returns a GENERIC 500 — the raw exception never reaches the public customer", async () => {
    // A DB/schema failure inside the handler must not hand its message (table/column names, missing-env-var
    // names) to an unauthenticated customer. The route logs it server-side and returns a generic error.
    // Locks the 2026-07-27 fix so a future edit can't re-introduce `detail: err.message` (A30 — gate the class).
    vi.mocked(getCareConversationByToken).mockRejectedValue(
      new Error('relation "support_messages" does not exist')
    );
    const res = await POST(postReq("valid-token"), ctx("conv-1"));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error?: string; detail?: unknown };
    expect(json.error).toBe("Server error.");
    expect(json.detail).toBeUndefined(); // the raw exception must NOT be in the response
    expect(JSON.stringify(json)).not.toContain("support_messages"); // belt-and-suspenders: no leak anywhere
  });
});

describe("POST /api/care/conversations/[id]/messages — customer IDOR guard (WRITE path)", () => {
  // GET's IDOR is tested above, but POST is a SEPARATE function with its own copy of the
  // `conversation.id !== id` check — and it is the WRITE path: a token holder injecting a message into
  // another customer's conversation (and triggering an AI reply into it) is strictly worse than a read. A
  // regression that weakened POST's guard alone would pass the GET tests. Lock POST independently.
  it("401 with no session token (never touches the DB)", async () => {
    const res = await POST(postReq(undefined as unknown as string), ctx("conv-1"));
    expect(res.status).toBe(401);
    expect(getCareConversationByToken).not.toHaveBeenCalled();
  });

  it("404 on an id-swap — a conv-OTHER token cannot post into conv-1, and no reply is generated", async () => {
    vi.mocked(getCareConversationByToken).mockResolvedValue({ id: "conv-OTHER" } as never);
    const res = await POST(postReq("valid-token-for-another-conversation"), ctx("conv-1"));
    expect(res.status).toBe(404); // must NOT append to / reply into conv-1 for a conv-OTHER token holder
    expect(generateCareReply).not.toHaveBeenCalled(); // the write + LLM path was never reached
  });

  it("404 when the token is invalid/expired (resolves to null) — no write", async () => {
    vi.mocked(getCareConversationByToken).mockResolvedValue(null as never);
    const res = await POST(postReq("bogus-or-expired"), ctx("conv-1"));
    expect(res.status).toBe(404);
    expect(generateCareReply).not.toHaveBeenCalled();
  });
});
