import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/coach/meeting-prep/[id]/document (Prep-up, founder 2026-08-22). Boundaries locked: 401 unauth; 403
 * no company; 404 for a non-owner prep; 400 on an unsupported file type (executables/archives refused) and on a
 * cross-company storagePath (no client-controlled read); sign mints a target; confirm EXTRACTS (image → OCR,
 * pdf/text → extractText) and stores the doc; extraction failure is GRACEFUL (note stored, upload not blocked).
 *
 * D2 hardening (audit 2026-08-23): the route now routes both shapes through the REAL validateUploadCandidate
 * chokepoint (so a spoofed SVG/executable is blocked by the SAME blocklist as the rest of the app, not this
 * route's weaker re-implementation) and re-checks the REAL uploaded size via getAssetObjectInfo at confirm. The
 * mock below therefore uses importActual for the pure chokepoint (validateUploadCandidate) and only stubs the IO
 * (sign/download/object-info), so the security tests exercise the real allowlist rather than a stubbed verdict.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/storage/assets", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/storage/assets")>();
  return {
    ...actual, // real validateUploadCandidate + blocklists (the D2 chokepoint under test)
    createSignedUploadTarget: vi.fn(async () => ({ ok: true, storagePath: "co1/2026/08/f.png", token: "tok" })),
    downloadAssetBytes: vi.fn(async () => ({ ok: true, bytes: Buffer.from("x"), contentType: "image/png" })),
    getAssetObjectInfo: vi.fn(async () => ({ sizeBytes: 100, contentType: "image/png" })),
  };
});
vi.mock("@/lib/documents/extractText", () => ({ extractText: vi.fn(async () => ({ text: "pdf text", format: "pdf" })) }));
vi.mock("@/lib/documents/extractImageText", () => ({ extractImageText: vi.fn(async () => "ocr text") }));
vi.mock("@/lib/data/meetingPrep", () => ({
  getMeetingPrep: vi.fn(async () => ({ id: "p1", companyId: "co1", createdBy: "u1" })),
  addPrepDocument: vi.fn(async (a) => ({ id: "d1", filename: a.filename, kind: a.kind, note: a.note, extractedText: a.extractedText, storagePath: a.storagePath })),
}));

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { getMeetingPrep, addPrepDocument } from "@/lib/data/meetingPrep";
import { extractImageText } from "@/lib/documents/extractImageText";
import { createSignedUploadTarget, downloadAssetBytes, getAssetObjectInfo } from "@/lib/storage/assets";
import { POST } from "../route";

function setAuth(userId: string | null) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}
function req(body: unknown): NextRequest {
  return { json: async () => body, headers: new Headers({ "content-type": "application/json" }) } as unknown as NextRequest;
}
const ctx = { params: Promise.resolve({ id: "p1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  setAuth("u1");
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
  (getMeetingPrep as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1", companyId: "co1", createdBy: "u1" });
  (getAssetObjectInfo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ sizeBytes: 100, contentType: "image/png" });
});

describe("POST meeting-prep document", () => {
  it("401 unauth / 403 no company / 404 non-owner prep", async () => {
    setAuth(null);
    expect((await POST(req({ kind: "sign", filename: "a.png" }), ctx)).status).toBe(401);
    setAuth("u1");
    (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(req({ kind: "sign", filename: "a.png" }), ctx)).status).toBe(403);
    (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
    (getMeetingPrep as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(req({ kind: "sign", filename: "a.png" }), ctx)).status).toBe(404);
  });

  it("400 refuses an executable/unsupported type — never mints a target", async () => {
    const res = await POST(req({ kind: "sign", filename: "malware.exe", mimeType: "application/x-msdownload" }), ctx);
    expect(res.status).toBe(400);
    expect(createSignedUploadTarget).not.toHaveBeenCalled();
  });

  it("D2: sign BLOCKS an SVG at the chokepoint even though it classifies as an image", async () => {
    // Regression guard: classifyKind() alone returns "image" for image/svg+xml (mt.startsWith("image/")). Only the
    // real validateUploadCandidate chokepoint catches the stored-XSS SVG vector — so this proves the route routes
    // through it, not through its own weaker allowlist. If someone reverts the chokepoint wiring, this goes green→red.
    const res = await POST(req({ kind: "sign", filename: "logo.svg", mimeType: "image/svg+xml" }), ctx);
    expect(res.status).toBe(400);
    expect(createSignedUploadTarget).not.toHaveBeenCalled();
  });

  it("sign mints an upload target for an allowed type", async () => {
    const res = await POST(req({ kind: "sign", filename: "notes.pdf", mimeType: "application/pdf" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ storagePath: "co1/2026/08/f.png", token: "tok" });
  });

  it("400 on a cross-company storagePath (no client-controlled read)", async () => {
    const res = await POST(req({ kind: "confirm", storagePath: "OTHERCO/x.png", filename: "x.png", mimeType: "image/png" }), ctx);
    expect(res.status).toBe(400);
  });

  it("D2: confirm 400 when the uploaded object is missing (phantom path)", async () => {
    (getAssetObjectInfo as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(req({ kind: "confirm", storagePath: "co1/x.png", filename: "x.png", mimeType: "image/png" }), ctx);
    expect(res.status).toBe(400);
    expect(downloadAssetBytes).not.toHaveBeenCalled(); // never buffers a phantom object
  });

  it("D2: confirm 413 when the REAL uploaded size exceeds the cap (under-declared at sign)", async () => {
    (getAssetObjectInfo as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ sizeBytes: 26 * 1024 * 1024, contentType: "image/png" });
    const res = await POST(req({ kind: "confirm", storagePath: "co1/x.png", filename: "x.png", mimeType: "image/png" }), ctx);
    expect(res.status).toBe(413);
    expect(downloadAssetBytes).not.toHaveBeenCalled(); // never buffers an over-cap object
  });

  it("confirm OCRs an image and stores the doc", async () => {
    const res = await POST(req({ kind: "confirm", storagePath: "co1/x.png", filename: "x.png", mimeType: "image/png", note: "whiteboard" }), ctx);
    expect(res.status).toBe(200);
    expect(extractImageText).toHaveBeenCalledTimes(1);
    const arg = (addPrepDocument as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(arg).toMatchObject({ kind: "image", note: "whiteboard", extractedText: "ocr text" });
  });

  it("confirm is GRACEFUL — extraction throwing still stores the note (upload not blocked)", async () => {
    (extractImageText as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("ocr boom"));
    const res = await POST(req({ kind: "confirm", storagePath: "co1/x.png", filename: "x.png", mimeType: "image/png", note: "kept" }), ctx);
    expect(res.status).toBe(200);
    const arg = (addPrepDocument as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(arg).toMatchObject({ note: "kept", extractedText: "" }); // note preserved, extraction empty
  });
});
