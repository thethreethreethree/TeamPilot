import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import {
  extractText,
  formatFor,
  SUPPORTED_EXTENSIONS,
  UnsupportedFormatError,
  EmptyExtractionError,
  MAX_EXTRACTED_CHARS,
} from "@/lib/documents/extractText";

/**
 * POST /api/coach/sales-session/extract  (multipart: field "file")
 *
 * Extracts plain text from an uploaded document so a manager can FILL the Coaching Methodology / Product
 * editors from a file instead of pasting (founder 2026-07-30). It does NOT save — the extracted text goes
 * back to the editor, the manager reviews it, then Saves via the existing /corpus|/product endpoint
 * (founder's "fill the draft for review" choice). Manager-gated, same as those editors (A28).
 *
 * nodejs runtime + a generous maxDuration: jszip + unpdf are not edge-compatible, and PDF parsing can
 * take a few seconds (deployment-config is its own correctness lens).
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB — well above any real methodology doc

async function resolve() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false as const };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isManager = isSalesCoachManager({
    role: (profile?.role as string | null) ?? null,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: null,
  });
  return {
    ok: true as const,
    companyId: (profile?.company_id as string | null) ?? null,
    isManager,
  };
}

export async function POST(req: NextRequest) {
  const ctx = await resolve();
  if (!ctx.ok) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });
  if (!ctx.isManager) {
    return NextResponse.json(
      { error: "Only an admin can upload coaching documents." },
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
      { error: "That file is larger than 15 MB. Please upload a smaller document." },
      { status: 413 }
    );
  }
  // Reject an unsupported extension BEFORE reading the whole body into memory.
  if (!formatFor(file.name)) {
    // Defer to extractText for the specific, friendly message (legacy .doc / .pages / unknown).
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
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    // A parser threw on a malformed/corrupt file — log server-side, return a generic message (CWE-209).
    console.error("[extract] extraction failed:", e);
    return NextResponse.json(
      { error: "Couldn't read that document. Try exporting it as PDF, DOCX, or TXT and re-uploading." },
      { status: 500 }
    );
  }
}
