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
  // SVG is an image type but can embed <script> — a stored-XSS vector if a signed URL is ever opened directly
  // (SVG executes as a document) or if attachments are ever served same-origin. Today's serving is cross-origin
  // (supabase signed URL) + rel=noopener, so impact is low, but we block at the CHOKEPOINT (§A27) so safety
  // doesn't depend on the serving model never changing. Founder: re-allow if you have a genuine SVG use case.
  "image/svg+xml",
  "image/svg",
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

/** Extension blocklist (audit F2) — the signed-URL path can't trust the
 *  client-claimed MIME, so block by filename extension too. Mirrors the MIME
 *  blocklist (video / executables / archives). */
export const BLOCKED_EXTENSIONS = [
  ".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv", ".m4v",
  ".exe", ".dll", ".msi", ".bat", ".cmd", ".com", ".scr", ".sh", ".app",
  ".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".bz2",
  ".svg", // stored-XSS vector (see BLOCKED_MIME_PREFIXES) — block by extension too, for a spoofed MIME
];

/**
 * The DANGEROUS-EXECUTABLE subset of BLOCKED_EXTENSIONS. For routes that must
 * accept media (audio/video call recordings are legitimately .webm/.mp4, which
 * BLOCKED_EXTENSIONS blocks) but must still refuse an executable disguised with a
 * spoofed audio/video Content-Type. Blocking these while allowing media is the
 * right cut for the recording-upload path, which can't use validateUploadCandidate
 * (that would reject .webm). Kept as a named subset so it can't drift.
 */
export const EXECUTABLE_EXTENSIONS = [
  ".exe", ".dll", ".msi", ".bat", ".cmd", ".com", ".scr", ".sh", ".app",
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
  // Code/data text types (folder uploads of projects, e.g. a browser
  // extension: manifest.json, .js, .xml). AGENT-ONLY (customers get the far
  // stricter list below). Founder-approved 2026-07-01.
  //
  // ⚠️ SECURITY RELIANCE (§A27): "never executed" holds ONLY because attachments are served from a CROSS-ORIGIN
  // Supabase signed URL (a different origin than the app) and linked with rel=noopener — so `text/html`,
  // `application/javascript`, and (were it not blocked) SVG execute, if at all, in the STORAGE origin, never the
  // app origin. This active-content set is safe by the SERVING MODEL, not by the type. If attachments are ever
  // proxied/served SAME-ORIGIN (e.g. through the app for access control), these become app-origin stored-XSS and
  // this allow-list must be re-evaluated (strip text/html + application/javascript, or sanitize on serve). SVG
  // is already blocked in BLOCKED_MIME_PREFIXES because it was reachable on the customer surface too.
  "application/json",
  "application/javascript",
  "application/xml",
  "font/",
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
  // Audit F2 — check the filename extension too (the claimed MIME is not
  // trustworthy on the signed-URL path).
  filename?: string;
  // Scoped exception (founder 2026-07-01): a FOLDER upload is zipped into one
  // .zip asset. Archives are otherwise blocked; allowArchive skips the archive
  // type/extension block for that path only (size is still enforced). The UI
  // sets this only for its own generated folder-zip.
  allowArchive?: boolean;
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
  // Scoped folder-archive: size is enforced above; skip the type/extension
  // gate for the UI's own generated .zip (archives stay blocked elsewhere).
  if (args.allowArchive) {
    return { ok: true };
  }
  if (args.filename) {
    const lower = args.filename.toLowerCase();
    if (BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return {
        ok: false,
        reason: "blocked_type",
        detail: `File extension of "${args.filename}" is blocked.`,
      };
    }
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
  // Preserve extension for browser content-type sniffing — but the filename is
  // USER-CONTROLLED, so the raw slice-after-last-dot can carry path characters
  // ("evil.x/../secret" → "./secret"). companyId (server profile) and fileId
  // (randomUUID) are trusted; the extension is the one untrusted input on this
  // path. Sanitize it to a plain alphanumeric extension so no '/', '..', or
  // other key characters can ever reach the storage key (defense-in-depth: even
  // if the storage backend treats keys literally today, we don't depend on it).
  const lastDot = args.originalFilename.lastIndexOf(".");
  const rawExt =
    lastDot >= 0 && lastDot < args.originalFilename.length - 1
      ? args.originalFilename.slice(lastDot + 1)
      : "";
  const cleanExt = rawExt.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12);
  const ext = cleanExt ? `.${cleanExt}` : "";
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
    // Per 2026-06-19 founder report: "Bucket not found" was the
    // opaque error. Detect that specific case and return an
    // actionable instruction instead of just the raw Supabase
    // message. Operator can then act on the right step (create
    // bucket via Dashboard) without having to read code or logs.
    const msg = error.message || "Unknown storage error.";
    if (/bucket not found|bucket does not exist/i.test(msg)) {
      return {
        ok: false,
        error: `Storage bucket '${ASSETS_BUCKET}' does not exist on this Supabase project. Create it via Supabase Dashboard → Storage → New bucket → Name: '${ASSETS_BUCKET}' → Public: OFF → File size limit: 25 MB. (Migration 0062 attempts to create it via SQL but newer Supabase Cloud instances may block storage.buckets INSERT from the SQL Editor; the Dashboard always works.)`,
      };
    }
    return { ok: false, error: msg };
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

/**
 * Create a SIGNED UPLOAD target so the browser can upload bytes DIRECT to
 * Storage (client → storage), bypassing the ~4.5 MB Vercel serverless
 * request-body limit that "Failed to fetch" on large files. The caller then
 * POSTs only metadata + this storagePath to /api/files. The bucket's own size
 * limit (25 MB) + validateUploadCandidate still apply. Reuses buildStoragePath
 * so the object layout is identical to the through-function path (§A21).
 */
export async function createSignedUploadTarget(args: {
  companyId: string;
  fileId: string;
  originalFilename: string;
}): Promise<
  { ok: true; storagePath: string; token: string } | { ok: false; error: string }
> {
  const storagePath = buildStoragePath(args);
  const sb = createAdminClient();
  const { data, error } = await sb.storage
    .from(ASSETS_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data?.token) {
    const msg = error?.message || "Could not create upload URL.";
    if (/bucket not found|bucket does not exist/i.test(msg)) {
      return {
        ok: false,
        error: `Storage bucket '${ASSETS_BUCKET}' does not exist. Create it via Supabase Dashboard → Storage → New bucket → '${ASSETS_BUCKET}', Public OFF.`,
      };
    }
    return { ok: false, error: msg };
  }
  return { ok: true, storagePath, token: data.token };
}

/**
 * Read the REAL metadata of an uploaded object (audit F2): the signed-URL
 * path can't trust the client-claimed size, so the server reads the actual
 * size from storage after upload. Also confirms the object EXISTS (reinforces
 * F1 — a record can't point at a phantom path). Returns null if not found.
 */
export async function getAssetObjectInfo(
  storagePath: string
): Promise<{ sizeBytes: number; contentType: string | null } | null> {
  const sb = createAdminClient();
  const lastSlash = storagePath.lastIndexOf("/");
  const dir = lastSlash >= 0 ? storagePath.slice(0, lastSlash) : "";
  const base = lastSlash >= 0 ? storagePath.slice(lastSlash + 1) : storagePath;
  const { data, error } = await sb.storage
    .from(ASSETS_BUCKET)
    .list(dir, { search: base, limit: 100 });
  if (error || !data) return null;
  const entry = data.find((e) => e.name === base);
  if (!entry) return null;
  const meta = (entry.metadata ?? {}) as { size?: number; mimetype?: string };
  return {
    sizeBytes: typeof meta.size === "number" ? meta.size : 0,
    contentType: meta.mimetype ?? null,
  };
}

export async function deleteAssetBytes(
  storagePath: string
): Promise<boolean> {
  const sb = createAdminClient();
  const { error } = await sb.storage.from(ASSETS_BUCKET).remove([storagePath]);
  return !error;
}
