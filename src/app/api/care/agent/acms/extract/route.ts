import { NextRequest, NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import {
  extractText,
  formatFor,
  SUPPORTED_EXTENSIONS,
  UnsupportedFormatError,
  EmptyExtractionError,
} from "@/lib/documents/extractText";

/**
 * POST /api/care/agent/acms/extract  (multipart: field "file", optional field "maxChars")
 *
 * Extracts plain text from an uploaded document so an admin can FILL a C.A.R.E field from a file
 * (founder 2026-07-30) — Adaptive Knowledge, Jeff's assistance guidance, or the product context. It does
 * NOT save; the extracted text goes back to the editor for review, then the existing config/knowledge
 * endpoint persists it. Admin-gated (uploading config content is an admin action), same as those saves.
 *
 * The caller passes `maxChars` = the TARGET field's cap, so extraction never exceeds what that field will
 * save (F5): Jeff-guidance + product-context are 8k, Adaptive Knowledge is 200k. nodejs runtime + a
 * generous maxDuration: jszip + unpdf are not edge-compatible and PDF parsing can be slow.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB — under Vercel's serverless body limit (F3)
const CEILING_CHARS = 200_000; // the largest C.A.R.E field (Adaptive Knowledge)

export async function POST(req: NextRequest) {
  const auth = await requireCareAgent();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: "Only an admin can upload C.A.R.E documents." },
      { status: 403 }
    );
  }

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
      { error: "That file is larger than 4 MB. Please upload a smaller document (or export just the text)." },
      { status: 413 }
    );
  }

  // Per-field cap (F5): the caller passes the target field's char limit; clamp to the largest C.A.R.E field.
  const requested = Number(form.get("maxChars"));
  const maxChars =
    Number.isFinite(requested) && requested > 0 ? Math.min(requested, CEILING_CHARS) : CEILING_CHARS;

  if (!formatFor(file.name)) {
    try {
      await extractText(new Uint8Array(0), file.name);
    } catch (e) {
      if (e instanceof UnsupportedFormatError) {
        return NextResponse.json({ error: e.message }, { status: 415 });
      }
    }
    return NextResponse.json(
      { error: `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}.` },
      { status: 415 }
    );
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  try {
    const { text, format } = await extractText(buf, file.name, { maxChars });
    return NextResponse.json({ text, format, chars: text.length, truncated: text.length >= maxChars });
  } catch (e) {
    if (e instanceof UnsupportedFormatError) {
      return NextResponse.json({ error: e.message }, { status: 415 });
    }
    if (e instanceof EmptyExtractionError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    // eslint-disable-next-line no-console
    console.error("[care.extract] extraction failed:", e);
    return NextResponse.json(
      { error: "Couldn't read that document. Try exporting it as PDF, DOCX, or TXT and re-uploading." },
      { status: 500 }
    );
  }
}
