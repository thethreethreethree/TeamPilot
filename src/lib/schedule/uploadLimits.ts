/**
 * Single source for the schedule binary-upload size limit (grid-pdf / VA import).
 *
 * The upload routes JSON-encode the file as base64. base64 inflates the raw bytes ~1.37× and the JSON envelope adds
 * a little more, so the request BODY must stay under Vercel's ~4.5 MB serverless request-body limit — meaning the
 * real DECODED-file ceiling is ~3 MB, not the 4.5 MB an older comment implied. A larger file was rejected by the
 * PLATFORM with an opaque 413 before the handler ran (the manager saw a generic failure). The client pre-checks the
 * raw file at MAX_UPLOAD_BYTES so the manager gets a clear limit; the routes cap the base64 body at
 * MAX_UPLOAD_BASE64_CHARS as the backstop. Both live HERE so the client-facing limit and the server cap can't drift.
 */

/** Max raw (decoded) file size a binary schedule upload accepts. */
export const MAX_UPLOAD_BYTES = 3_000_000; // ~3 MB

/** Server backstop: the base64 string cap. ~3 MB × 1.37 ≈ 4.1 MB, kept under the ~4.5 MB request-body limit. */
export const MAX_UPLOAD_BASE64_CHARS = 4_200_000;

/** A clear, honest oversize message for the manager, or null if the file is within the limit. */
export function oversizeMessage(sizeBytes: number): string | null {
  if (sizeBytes <= MAX_UPLOAD_BYTES) return null;
  return `That file is ${(sizeBytes / 1_000_000).toFixed(1)} MB — the upload limit is ${(MAX_UPLOAD_BYTES / 1_000_000).toFixed(0)} MB. Export a smaller date range or split it into separate files.`;
}
