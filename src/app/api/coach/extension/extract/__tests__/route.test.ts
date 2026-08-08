import { describe, it, expect, vi, beforeEach } from "vitest";

// The extract route is the conversation-file → text ingestion path. It reuses the shared documents/extractText
// util (tested elsewhere) and guardExtensionRequest (tested elsewhere); what's worth locking HERE is the
// route's own gate + input validation: it runs the entitlement guard, and rejects a missing/unsupported/empty
// file with the right status BEFORE any parsing.

vi.mock("@/lib/api/extensionGuard", () => ({ guardExtensionRequest: vi.fn() }));
vi.mock("@/lib/documents/extractText", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, extractText: vi.fn(async () => ({ text: "prospect: hi\nrep: hello", format: "txt" })) };
});

import { POST } from "../route";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { extractText } from "@/lib/documents/extractText";
import { NextRequest } from "next/server";

function guardOk() {
  vi.mocked(guardExtensionRequest).mockResolvedValue({
    ok: true,
    user: { userId: "u1", companyId: "c1", entitlement: {} },
    body: null,
  } as never);
}
function reqWith(file?: File): NextRequest {
  const fd = new FormData();
  if (file) fd.append("file", file);
  return new NextRequest("http://localhost/api/coach/extension/extract", {
    method: "POST",
    body: fd as unknown as BodyInit,
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/coach/extension/extract — gate + file validation", () => {
  it("returns the guard's response when the gate denies (never parses)", async () => {
    vi.mocked(guardExtensionRequest).mockResolvedValue({ ok: false, response: { status: 402 } } as never);
    const res = (await POST(reqWith())) as unknown as { status: number };
    expect(res.status).toBe(402);
    expect(extractText).not.toHaveBeenCalled();
  });

  it("400 when no file field is present", async () => {
    guardOk();
    const res = await POST(reqWith());
    expect(res.status).toBe(400);
    expect(extractText).not.toHaveBeenCalled();
  });

  it("415 for an unsupported extension (rejected before reading the body)", async () => {
    guardOk();
    // .png is an image, not a document type extractText handles → rejected up front.
    const res = await POST(reqWith(new File(["\x89PNG"], "screenshot.png", { type: "image/png" })));
    expect(res.status).toBe(415);
    expect(extractText).not.toHaveBeenCalled();
  });

  it("200 + extracted text for a supported file (the happy path feeds capture)", async () => {
    guardOk();
    const res = await POST(reqWith(new File(["prospect: hi"], "chat.txt", { type: "text/plain" })));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toContain("prospect: hi");
    expect(extractText).toHaveBeenCalledOnce();
  });
});
