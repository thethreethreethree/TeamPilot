import { NextRequest, NextResponse } from "next/server";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import {
  extractText,
  formatFor,
  SUPPORTED_EXTENSIONS,
  UnsupportedFormatError,
  EmptyExtractionError,
  MAX_EXTRACTED_CHARS,
} from "@/lib/documents/extractText";

/**
 * POST /api/coach/extension/extract  (multipart: field "file") — for the Sales Coach browser extension.
 *
 * Lets a rep UPLOAD a conversation (a PDF/DOCX/TXT they exported from a chat) instead of auto-scanning the page,
 * so the tools work on threads the adapters can't reach (founder 2026-08-09). It extracts plain text server-side
 * (unpdf/mammoth via the shared documents/extractText util) and returns it; the panel then uses that text as the
 * captured conversation for Summarize / Read-the-room / Suggested Response. Does NOT store — ephemeral, like
 * every other extension tool.
 *
 * This is an INGESTION helper, not a coaching tool (no LLM call here), but it is still a paid extension surface,
 * so it runs the SAME gate as the tools via guardExtensionRequest (no schema → auth + rate limit only, then we
 * read the multipart body). nodejs runtime + a maxDuration for PDF parsing (unpdf isn't edge-compatible).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

// Multipart bodies pass THROUGH the serverless function (Vercel caps ~4.5 MB); 4 MB stays safely under and
// covers any real text conversation export. (Scanned image PDFs have no text layer and yield an empty extract.)
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // No schema: run IP-guard → entitlement → per-user rate limit, but do NOT consume the body (it's multipart).
  const guard = await guardExtensionRequest(req, {
    tool: "coach-extract",
    perUserMax: 20,
    productLabel: "Sales Coach extension",
  });
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was provided." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "That file is larger than 4 MB. Upload a smaller file (or paste the text)." },
      { status: 413 }
    );
  }
  // Reject an unsupported extension before reading the whole body into memory.
  if (!formatFor(file.name)) {
    return NextResponse.json(
      { error: `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}.` },
      { status: 415 }
    );
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  try {
    const { text, format } = await extractText(buf, file.name);
    return NextResponse.json({
      text,
      format,
      chars: text.length,
      truncated: text.length >= MAX_EXTRACTED_CHARS,
    });
  } catch (e) {
    if (e instanceof UnsupportedFormatError) {
      return NextResponse.json({ error: e.message }, { status: 415 });
    }
    if (e instanceof EmptyExtractionError) {
      return NextResponse.json(
        { error: "Couldn't find any text in that file (a scanned image PDF has no text layer). Paste the text instead." },
        { status: 422 }
      );
    }
    // Malformed/corrupt file — log server-side, return a generic message (CWE-209, no raw parser internals).
    console.error("[coach/extension/extract] extraction failed:", e);
    return NextResponse.json(
      { error: "Couldn't read that file. Try exporting it as PDF or TXT and re-uploading." },
      { status: 500 }
    );
  }
}
