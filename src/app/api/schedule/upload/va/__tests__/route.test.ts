import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * VA upload preview + commit routes. Pins: manager-only (a non-manager gets 403, nothing extracted/written),
 * auth-first, honest CWE-209 errors mapped from the extractor's typed failures, and the commit's refusal on
 * unparsed blocks. The extraction/resolve core is tested elsewhere (vaGrid/vaDocx/vaPdf/vaResolve); here the
 * IO helper is mocked so the tests exercise the ROUTE contract (auth, validation, error mapping, commit RPC).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/schedule/vaImport", () => ({ extractAndResolveVa: vi.fn() }));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { extractAndResolveVa } from "@/lib/schedule/vaImport";
import { UnsupportedFormatError, EmptyExtractionError } from "@/lib/documents/extractText";
import { POST as PREVIEW } from "../preview/route";
import { POST as COMMIT } from "../commit/route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const manager = { userId: "u1", companyId: "c1", role: "admin", isAdmin: true };
const member = { userId: "u2", companyId: "c1", role: "Member", isAdmin: false };

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof PREVIEW>[0];
}
const validBody = { fileBase64: Buffer.from("x").toString("base64"), filename: "va.docx", weekStart: "2026-08-17" };
const previewResult = {
  preview: { staff: ["Alex"], entries: [{ employeeName: "Alex", date: "2026-08-17", rawCode: "10:00-14:00", kind: "shift", times: { start: "10:00", end: "14:00" } }] },
  unparsedBlocks: [] as string[],
};

let rpcCalled = false;
function fakeSb() {
  return {
    // roster read is now paged: .from().select().eq().order().range() → { data, error }
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }) }) }),
    rpc: async () => { rpcCalled = true; return { data: { staffCreated: 1, shiftsCreated: 5, assignmentsCreated: 5 }, error: null }; },
  };
}

beforeEach(() => {
  vi.clearAllMocks(); // reset call history AND implementations between tests
  rpcCalled = false;
  asMock(createClient).mockResolvedValue(fakeSb());
  asMock(extractAndResolveVa).mockResolvedValue(previewResult);
});

describe("POST /api/schedule/upload/va/preview", () => {
  it("a MANAGER gets the resolved preview (200, readyToCommit)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(manager);
    const res = await PREVIEW(req(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ staff: ["Alex"], entryCount: 1, readyToCommit: true });
  });
  it("a NON-manager is refused (403) and nothing is extracted", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(member);
    expect((await PREVIEW(req(validBody))).status).toBe(403);
    expect(extractAndResolveVa).not.toHaveBeenCalled();
  });
  it("401 unauthenticated; 415 unsupported format; 422 empty (typed errors → safe messages)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await PREVIEW(req(validBody))).status).toBe(401);
    asMock(getCurrentAuthContext).mockResolvedValue(manager);
    asMock(extractAndResolveVa).mockRejectedValueOnce(new UnsupportedFormatError("xls", "nope"));
    expect((await PREVIEW(req({ ...validBody, filename: "s.xls" }))).status).toBe(415);
    asMock(extractAndResolveVa).mockRejectedValueOnce(new EmptyExtractionError());
    expect((await PREVIEW(req(validBody))).status).toBe(422);
  });
});

describe("POST /api/schedule/upload/va/commit", () => {
  it("a MANAGER commits atomically (201 with counts)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(manager);
    const res = await COMMIT(req(validBody));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ shiftsCreated: 5, assignmentsCreated: 5 });
    expect(rpcCalled).toBe(true);
  });
  it("REFUSES (400) when a time block is unparsed — no write", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(manager);
    asMock(extractAndResolveVa).mockResolvedValueOnce({ preview: previewResult.preview, unparsedBlocks: ["sometime"] });
    expect((await COMMIT(req(validBody))).status).toBe(400);
    expect(rpcCalled).toBe(false);
  });
  it("a NON-manager cannot commit (403)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(member);
    expect((await COMMIT(req(validBody))).status).toBe(403);
    expect(rpcCalled).toBe(false);
  });
});
