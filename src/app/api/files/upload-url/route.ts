import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  createSignedUploadTarget,
  validateUploadCandidate,
  ASSETS_BUCKET,
} from "@/lib/storage/assets";
import { randomUUID } from "crypto";

/**
 * POST /api/files/upload-url
 *
 * Mints a SIGNED UPLOAD target so the browser can upload a file DIRECT to
 * Storage, bypassing the ~4.5 MB serverless body limit (the "Failed to fetch"
 * on large files). Validates the claimed size/type up front (the bucket
 * enforces the real ceiling too). The client then uploads via the token and
 * POSTs metadata + storagePath to /api/files. One call per file — a folder is
 * many calls. Auth-gated (agent).
 */
const Body = z.object({
  filename: z.string().min(1).max(400),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  // Generous — a folder fires one per file, but bounded against abuse.
  const limited = rateLimit(req, {
    id: "files-upload-url",
    windowMs: 60_000,
    max: 200,
  });
  if (limited) return limited;

  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const mimeType = body.mimeType || "application/octet-stream";
  // Same gate as the through-function path — reject oversized/blocked up front.
  const v = validateUploadCandidate({
    sizeBytes: body.sizeBytes,
    mimeType,
    uploadedVia: "agent_dashboard",
    filename: body.filename, // F2 — reject blocked extensions up front too
  });
  if (!v.ok) {
    return NextResponse.json({ error: v.detail, reason: v.reason }, { status: 400 });
  }

  const fileId = randomUUID();
  const target = await createSignedUploadTarget({
    companyId: auth.companyId,
    fileId,
    originalFilename: body.filename,
  });
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: 500 });
  }

  return NextResponse.json({
    bucket: ASSETS_BUCKET,
    storagePath: target.storagePath,
    token: target.token,
  });
}
