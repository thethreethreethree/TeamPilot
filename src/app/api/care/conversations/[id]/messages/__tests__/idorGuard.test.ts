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

import { GET } from "@/app/api/care/conversations/[id]/messages/route";
import { getCareConversationByToken } from "@/lib/data/care";

const req = (token?: string) =>
  ({ headers: { get: (k: string) => (k === "x-care-session" ? token ?? null : null) } }) as never;
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
