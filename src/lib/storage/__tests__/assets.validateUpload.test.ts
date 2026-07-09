import { describe, expect, it } from "vitest";
import {
  validateUploadCandidate,
  AGENT_MAX_BYTES,
  CUSTOMER_MAX_BYTES,
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
