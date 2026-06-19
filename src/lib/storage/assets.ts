import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Asset System v1 — Supabase Storage helpers.
 *
 * Bucket: assets-v1 (created via the SQL at the bottom of
 * migration 0057). Object naming convention:
 *
 *   {companyId}/{YYYY}/{MM}/{fileId}{.ext}
 *
 * Per CLAUDE.md §3.1: storage_path is immutable on the files
 * row (preserved by the trigger in migration 0056). The path
 * embeds metadata for human-readable navigation in the
 * Supabase dashboard AND for the (future) Phase 7 folder
 * system which can compute its tree purely from these paths.
 */

export const ASSETS_BUCKET = "assets-v1";

export const AGENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
export const CUSTOMER_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Block list. Anything not in the allow list AND not explicitly
 *  blocked gets rejected too; this is a defense-in-depth list. */
export const BLOCKED_MIME_PREFIXES = [
  "video/", // explicitly blocked per founder red-pen 2026-06-19
  "application/x-executable",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/vnd.microsoft.portable-executable",
  "application/x-sh",
  "application/zip", // archives blocked
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
];

/** Allow list for agent dashboard uploads. */
export const AGENT_ALLOWED_MIME_PREFIXES = [
  "image/",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument", // .docx/.xlsx/.pptx
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/",
  "audio/",
];

/** Stricter allow list for customer-widget uploads. */
export const CUSTOMER_ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];

export type UploadValidationFail = {
  ok: false;
  reason: "too_large" | "blocked_type" | "not_allowed_type" | "empty";
  detail: string;
};

export type UploadValidationOk = { ok: true };

export function validateUploadCandidate(args: {
  sizeBytes: number;
  mimeType: string;
  uploadedVia: "agent_dashboard" | "customer_widget";
}): UploadValidationOk | UploadValidationFail {
  if (args.sizeBytes <= 0) {
    return { ok: false, reason: "empty", detail: "File is empty." };
  }
  const cap =
    args.uploadedVia === "agent_dashboard" ? AGENT_MAX_BYTES : CUSTOMER_MAX_BYTES;
  if (args.sizeBytes > cap) {
    return {
      ok: false,
      reason: "too_large",
      detail: `File exceeds the ${cap / (1024 * 1024)} MB cap.`,
    };
  }
  const mime = args.mimeType.toLowerCase();
  if (BLOCKED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    return {
      ok: false,
      reason: "blocked_type",
      detail: `File type ${mime} is blocked.`,
    };
  }
  const allowList =
    args.uploadedVia === "agent_dashboard"
      ? AGENT_ALLOWED_MIME_PREFIXES
      : CUSTOMER_ALLOWED_MIME_PREFIXES;
  if (!allowList.some((p) => mime.startsWith(p))) {
    return {
      ok: false,
      reason: "not_allowed_type",
      detail: `File type ${mime} is not in the v1 allow list.`,
    };
  }
  return { ok: true };
}

export function buildStoragePath(args: {
  companyId: string;
  fileId: string;
  originalFilename: string;
}): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  // Preserve extension for browser content-type sniffing
  const lastDot = args.originalFilename.lastIndexOf(".");
  const ext =
    lastDot >= 0 && lastDot < args.originalFilename.length - 1
      ? args.originalFilename.slice(lastDot).toLowerCase()
      : "";
  return `${args.companyId}/${year}/${month}/${args.fileId}${ext}`;
}

/**
 * Upload bytes to Supabase Storage using the service-role
 * client. Returns the storage path on success. The file row in
 * the files table is the caller's responsibility (so the row
 * write + storage write can be coordinated).
 */
export async function uploadAssetBytes(args: {
  storagePath: string;
  bytes: ArrayBuffer | Uint8Array;
  contentType: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  const { error } = await sb.storage
    .from(ASSETS_BUCKET)
    .upload(args.storagePath, args.bytes as Uint8Array, {
      contentType: args.contentType,
      upsert: false,
    });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Issue a short-lived signed URL for a private object so the
 * browser can download / preview it. Per the v1 design the
 * bucket is private; signed URLs are the way to expose objects
 * to the user agent.
 */
export async function signAssetUrl(args: {
  storagePath: string;
  expiresInSeconds?: number;
}): Promise<string | null> {
  const sb = createAdminClient();
  const { data, error } = await sb.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(args.storagePath, args.expiresInSeconds ?? 300);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function deleteAssetBytes(
  storagePath: string
): Promise<boolean> {
  const sb = createAdminClient();
  const { error } = await sb.storage.from(ASSETS_BUCKET).remove([storagePath]);
  return !error;
}
