import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/publicApi";
import { finalizeCall } from "@/lib/api/publicApiUpload";

// Transcribing the uploaded call takes as long as an app upload (the same work).
export const maxDuration = 300;

/**
 * POST /api/v1/calls/:id/finalize {path} — after PUTting the file to the signed upload from POST /api/v1/calls (Engage
 * plan E6): checks the stored file, attaches it to the call, ends and transcribes it. Key scope "upload".
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // The gate, here at the top: a live company key with the "upload" scope, inside its limits.
  const caller = await authenticateApiKey(req, "upload", "/api/v1/calls/finalize");
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  return finalizeCall(req, caller, id);
}
