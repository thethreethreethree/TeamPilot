import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createSignedUploadTarget, downloadAssetBytes } from "@/lib/storage/assets";
import { extractText } from "@/lib/documents/extractText";
import { extractImageText } from "@/lib/documents/extractImageText";
import { getMeetingPrep, addPrepDocument } from "@/lib/data/meetingPrep";

/**
 * POST /api/coach/meeting-prep/[id]/document — attach a Prep-up document (Team-Sync, founder 2026-08-22).
 * Two shapes (audio-upload pattern — direct-to-storage to dodge the ~4.5 MB body cap; works the same on web +
 * mobile webapp):
 *   { kind: "sign" }    → validate the file type + mint a signed upload target; the client uploads DIRECT to storage.
 *   { kind: "confirm" } → server downloads the uploaded bytes, EXTRACTS text (image → token-free Tesseract OCR;
 *                         pdf/text/docx → extractText), and stores the document row with its note + extracted text.
 * Owner-only (the prep's facilitator); the storagePath is pinned to the caller's company. Extraction is graceful:
 * a failure stores the note alone (never blocks the upload). CWE-209: raw errors are logged, not returned.
 */

const SignBody = z.object({
  kind: z.literal("sign"),
  filename: z.string().min(1).max(200),
  mimeType: z.string().max(120).default(""),
});
const ConfirmBody = z.object({
  kind: z.literal("confirm"),
  storagePath: z.string().min(1).max(400),
  filename: z.string().min(1).max(200),
  mimeType: z.string().max(120).default(""),
  note: z.string().max(2000).default(""),
});
const Body = z.discriminatedUnion("kind", [SignBody, ConfirmBody]);

// OCR (Tesseract, incl. first-run engine load) + extractText need headroom beyond the short default.
export const maxDuration = 120;

/** Accepted Prep-up doc types → the stored `kind`. Anything else is refused (executables/archives/etc.). */
function classifyKind(filename: string, mimeType: string): "image" | "text" | "pdf" | null {
  const ext = (filename.toLowerCase().split(".").pop() ?? "").trim();
  const mt = mimeType.toLowerCase();
  if (mt.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "heic", "heif"].includes(ext)) return "image";
  if (mt === "application/pdf" || ext === "pdf") return "pdf";
  if (mt.startsWith("text/") || ["txt", "md", "markdown", "csv", "rtf", "html", "docx", "odt", "epub"].includes(ext)) return "text";
  return null;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "meeting-prep-doc", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  // Owner-only: the caller must own this prep (RLS-scoped read → null for a non-owner).
  const prep = await getMeetingPrep(id);
  if (!prep) return NextResponse.json({ error: "Prep not found or not accessible." }, { status: 404 });

  const kind = classifyKind(body.filename, body.mimeType);
  if (!kind) return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });

  if (body.kind === "sign") {
    const target = await createSignedUploadTarget({
      companyId,
      fileId: randomUUID(),
      originalFilename: body.filename,
    });
    if (!target.ok) {
      console.error("[meeting-prep doc] signed-upload target failed:", target.error);
      return NextResponse.json({ error: "Couldn't prepare the upload. Try again." }, { status: 502 });
    }
    return NextResponse.json({ storagePath: target.storagePath, token: target.token });
  }

  // confirm: bind the client-echoed path to the caller's company (the worker/service-role read bypasses RLS).
  if (!body.storagePath.startsWith(`${companyId}/`)) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
  }

  const dl = await downloadAssetBytes({ storagePath: body.storagePath });
  if (!dl.ok || !dl.bytes) {
    console.error("[meeting-prep doc] download failed:", dl.error);
    return NextResponse.json({ error: "Couldn't read the uploaded file." }, { status: 502 });
  }

  // Extract — GRACEFUL: any failure stores the note alone (the upload never breaks over extraction).
  let extractedText = "";
  try {
    extractedText = kind === "image" ? await extractImageText(dl.bytes) : (await extractText(dl.bytes, body.filename)).text;
  } catch (e) {
    // EmptyExtractionError (e.g. a scanned pdf) / UnsupportedFormatError / any parse error → note-only.
    console.error("[meeting-prep doc] extraction failed (storing note only):", e instanceof Error ? e.message : e);
    extractedText = "";
  }

  const document = await addPrepDocument({
    prepId: id,
    companyId,
    storagePath: body.storagePath,
    filename: body.filename,
    kind,
    note: body.note,
    extractedText,
  });
  if (!document) return NextResponse.json({ error: "Couldn't save the document." }, { status: 500 });
  return NextResponse.json({ document });
}
