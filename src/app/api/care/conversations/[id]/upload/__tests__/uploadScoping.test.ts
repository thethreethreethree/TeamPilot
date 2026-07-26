import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Conversation-scoping guard on the customer upload endpoint. Each customer route carries its OWN copy of
 * the `conv.id === <URL id>` check, so it's independently regressable — a test on the messages route does
 * NOT protect this one. Here the stakes are a cross-conversation WRITE: without the guard a token holder
 * could upload a file into ANOTHER customer's conversation (poisoning / storage abuse). Also locks the
 * closed-conversation gate. These return before any FormData/file processing, so only the token resolver +
 * rate limit are mocked.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/data/care", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getCareConversationByToken: vi.fn() };
});

import { POST } from "@/app/api/care/conversations/[id]/upload/route";
import { getCareConversationByToken } from "@/lib/data/care";

const req = (token?: string) =>
  ({ headers: { get: (k: string) => (k === "x-care-session" ? token ?? null : null) } }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("POST customer upload — conversation-scoping guard", () => {
  it("401 with no session token (never touches the DB)", async () => {
    expect((await POST(req(undefined), ctx("conv-1"))).status).toBe(401);
    expect(getCareConversationByToken).not.toHaveBeenCalled();
  });

  it("404 when the token's conversation != the URL id — no upload into another customer's conversation", async () => {
    vi.mocked(getCareConversationByToken).mockResolvedValue({ id: "conv-OTHER", status: "open" } as never);
    expect((await POST(req("tok-for-other-conv"), ctx("conv-1"))).status).toBe(404);
  });

  it("410 when the (own) conversation is closed — no uploads onto a closed thread", async () => {
    vi.mocked(getCareConversationByToken).mockResolvedValue({ id: "conv-1", status: "closed" } as never);
    expect((await POST(req("tok"), ctx("conv-1"))).status).toBe(410);
  });
});
