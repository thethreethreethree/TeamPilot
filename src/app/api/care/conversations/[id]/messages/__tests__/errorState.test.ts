import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The widget messages GET must surface a DB fetch FAILURE as 500 — NOT the old 200 + [] that made the
 * customer's chat flash empty on a transient poll error (error-as-no-data). The widget's loadMessages
 * checks res.ok and keeps its prior messages on any non-ok, so 500 = "keep what's on screen".
 * A genuine empty thread (no error) still returns 200 with [].
 */
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/data/care", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCareConversationByToken: vi.fn(),
    listCareMessagesForCustomer: vi.fn(),
    getCareTenantConfigByCompanyId: vi.fn(async () => null),
  };
});

import { GET } from "@/app/api/care/conversations/[id]/messages/route";
import {
  getCareConversationByToken,
  listCareMessagesForCustomer,
} from "@/lib/data/care";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const req = (token = "tok") =>
  ({
    headers: { get: (k: string) => (k === "x-care-session" ? token : null) },
  }) as never;
const ctx = { params: Promise.resolve({ id: "conv1" }) } as never;

beforeEach(() => {
  vi.clearAllMocks();
  asMock(getCareConversationByToken).mockResolvedValue({
    id: "conv1",
    companyId: "co1",
    status: "open",
    aiResponding: true,
  });
});

describe("GET widget messages — error-as-no-data fix", () => {
  it("a message-fetch FAILURE → 500 (never 200+[] that would flash the chat empty)", async () => {
    asMock(listCareMessagesForCustomer).mockRejectedValue(new Error("db down"));
    const res = await GET(req(), ctx);
    expect(res.status).toBe(500);
  });

  it("a bad/expired token (conversation not found) → 404, never a 500 (the error path is only for real fetch failures)", async () => {
    asMock(getCareConversationByToken).mockResolvedValue(null);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
  });
});
