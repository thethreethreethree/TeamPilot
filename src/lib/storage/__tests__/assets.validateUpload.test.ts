import { describe, expect, it } from "vitest";
import {
  validateUploadCandidate,
  AGENT_MAX_BYTES,
  CUSTOMER_MAX_BYTES,
  EXECUTABLE_EXTENSIONS,
  BLOCKED_EXTENSIONS,
} from "../assets";

/**
 * The file-upload SECURITY gate. Pure function; regression-locking it so a change
 * that silently weakened it (allowed an executable, dropped a size cap, or relaxed
 * the customer allow-list) would fail here. Covers the defense-in-depth layers:
 * size caps, MIME block-list, filename-EXTENSION block (the claimed MIME is not
 * trustworthy on the signed-URL path), and the per-surface allow-lists.
 */
describe("validateUploadCandidate", () => {
  const agent = "agent_dashboard" as const;
  const customer = "customer_widget" as const;

  it("rejects an empty file", () => {
    expect(validateUploadCandidate({ sizeBytes: 0, mimeType: "image/png", uploadedVia: agent }))
      .toMatchObject({ ok: false, reason: "empty" });
  });

  it("enforces the agent size cap (25 MB)", () => {
    expect(
      validateUploadCandidate({ sizeBytes: AGENT_MAX_BYTES + 1, mimeType: "image/png", uploadedVia: agent })
    ).toMatchObject({ ok: false, reason: "too_large" });
    expect(
      validateUploadCandidate({ sizeBytes: AGENT_MAX_BYTES, mimeType: "image/png", uploadedVia: agent })
    ).toEqual({ ok: true });
  });

  it("enforces the stricter customer size cap (10 MB)", () => {
    // A size fine for an agent is too large for a customer.
    expect(
      validateUploadCandidate({ sizeBytes: CUSTOMER_MAX_BYTES + 1, mimeType: "image/png", uploadedVia: customer })
    ).toMatchObject({ ok: false, reason: "too_large" });
    expect(CUSTOMER_MAX_BYTES).toBeLessThan(AGENT_MAX_BYTES);
  });

  it("blocks an executable by MIME type", () => {
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "application/x-msdownload", uploadedVia: agent })
    ).toMatchObject({ ok: false, reason: "blocked_type" });
  });

  it("blocks by filename EXTENSION even when the claimed MIME lies (MIME-spoof defense)", () => {
    // An .exe renamed with an image MIME must still be blocked by the extension check.
    expect(
      validateUploadCandidate({
        sizeBytes: 100,
        mimeType: "image/png",
        filename: "totally-a-picture.exe",
        uploadedVia: agent,
      })
    ).toMatchObject({ ok: false, reason: "blocked_type" });
  });

  it("blocks a TRAILING-SPACE/DOT filename that Windows would normalize back to an executable", () => {
    // Windows strips trailing dots + spaces when it saves a file, so `evil.exe ` / `evil.exe.` would sail
    // past a naive endsWith() blocklist here and re-materialize as `evil.exe` on a victim's disk. The
    // normalization in validateUploadCandidate closes that; both variants (spoofed image MIME) must block.
    for (const filename of ["evil.exe ", "evil.exe.", "evil.exe.  ", "evil.EXE "]) {
      expect(
        validateUploadCandidate({ sizeBytes: 100, mimeType: "image/png", filename, uploadedVia: agent })
      ).toMatchObject({ ok: false, reason: "blocked_type" });
    }
    // A legitimate filename with a trailing space (no dangerous extension) is unaffected by the trim.
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "image/png", filename: "vacation.png ", uploadedVia: agent })
    ).toMatchObject({ ok: true });
  });

  it("blocks a MIME-spoofed executable on the PUBLIC customer path too (security 2026-07-09)", () => {
    // The customer widget upload route is public + unauthenticated. Both care upload
    // routes previously skipped `filename`, so this extension defense never fired on
    // them; now that they pass it, a customer uploading evil.exe with a spoofed
    // image/png MIME must be rejected. A legit image must still pass on the same path.
    expect(
      validateUploadCandidate({
        sizeBytes: 100,
        mimeType: "image/png",
        filename: "invoice.exe",
        uploadedVia: customer,
      })
    ).toMatchObject({ ok: false, reason: "blocked_type" });
    expect(
      validateUploadCandidate({
        sizeBytes: 100,
        mimeType: "image/png",
        filename: "screenshot.png",
        uploadedVia: customer,
      })
    ).toEqual({ ok: true });
  });

  it("blocks archives by default but allows the scoped folder-zip via allowArchive", () => {
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "application/zip", uploadedVia: agent })
    ).toMatchObject({ ok: false, reason: "blocked_type" });
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "application/zip", uploadedVia: agent, allowArchive: true })
    ).toEqual({ ok: true });
  });

  it("blocks SVG despite the image/ allow-prefix (stored-XSS vector) — by MIME and by extension", () => {
    // image/svg+xml matches the image/ allow-list but the block-list is checked FIRST.
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "image/svg+xml", uploadedVia: customer })
    ).toMatchObject({ ok: false, reason: "blocked_type" });
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "image/svg+xml", uploadedVia: agent })
    ).toMatchObject({ ok: false, reason: "blocked_type" });
    // And by extension, in case the client spoofs the MIME as image/png but ships a .svg.
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "image/png", filename: "logo.svg", uploadedVia: customer })
    ).toMatchObject({ ok: false, reason: "blocked_type" });
    expect(BLOCKED_EXTENSIONS).toContain(".svg");
  });

  it("allows a normal image for both surfaces", () => {
    expect(validateUploadCandidate({ sizeBytes: 100, mimeType: "image/png", uploadedVia: agent })).toEqual({ ok: true });
    expect(validateUploadCandidate({ sizeBytes: 100, mimeType: "image/jpeg", uploadedVia: customer })).toEqual({ ok: true });
  });

  it("customer allow-list is stricter than the agent's (docs allowed for agent, not customer)", () => {
    // A Word doc is allowed for an agent...
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "application/msword", uploadedVia: agent })
    ).toEqual({ ok: true });
    // ...but NOT for a customer-widget upload (image + pdf only).
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "application/msword", uploadedVia: customer })
    ).toMatchObject({ ok: false, reason: "not_allowed_type" });
  });

  it("blocks video explicitly (founder red-pen 2026-06-19)", () => {
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "video/mp4", uploadedVia: agent })
    ).toMatchObject({ ok: false, reason: "blocked_type" });
  });

  it("rejects a type in neither the allow nor block list (not_allowed_type)", () => {
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "application/octet-stream", uploadedVia: agent })
    ).toMatchObject({ ok: false, reason: "not_allowed_type" });
  });

  it("documents the intentional broad agent allow-list (text/* is allowed by design)", () => {
    // text/*, application/javascript, and image/svg+xml ARE allowed for AGENT
    // uploads — founder-approved 2026-07-01 for project/folder uploads. Safe
    // because assets are served cross-origin from Supabase storage (signed URLs),
    // never executed in the app origin; executables/video/archives stay blocked by
    // MIME + extension. Pinned here so a future flip is a conscious, test-caught
    // change rather than an accident.
    expect(
      validateUploadCandidate({ sizeBytes: 100, mimeType: "text/plain", uploadedVia: agent })
    ).toEqual({ ok: true });
  });
});

/**
 * EXECUTABLE_EXTENSIONS is the dangerous-executable subset used by the recording
 * upload route (which can't use validateUploadCandidate — that rejects .webm/.mp4).
 * Its whole purpose: block executables WHILE allowing media. Lock both directions so
 * a future edit can't (a) drop an executable or (b) accidentally add a media ext.
 */
describe("EXECUTABLE_EXTENSIONS (recording-upload defense-in-depth)", () => {
  it("blocks the dangerous executables", () => {
    for (const ext of [".exe", ".dll", ".msi", ".bat", ".cmd", ".com", ".scr", ".sh", ".app"]) {
      expect(EXECUTABLE_EXTENSIONS).toContain(ext);
    }
  });

  it("does NOT contain media extensions (recordings are legitimately .webm/.mp4)", () => {
    for (const ext of [".webm", ".mp4", ".mov", ".m4v", ".mkv"]) {
      expect(EXECUTABLE_EXTENSIONS).not.toContain(ext);
    }
  });

  it("is a strict subset of BLOCKED_EXTENSIONS (no divergent executable)", () => {
    for (const ext of EXECUTABLE_EXTENSIONS) expect(BLOCKED_EXTENSIONS).toContain(ext);
  });
});
