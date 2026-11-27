import { readResource } from "@/lib/api/publicApiRead";
import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/publicApi";
import { uploadCall } from "@/lib/api/publicApiUpload";

// Transcribing an uploaded call takes as long as an app upload (the same work).
export const maxDuration = 300;

/** GET /api/v1/calls — the public read API (Engage plan E3, 0378; Gong M31). Key auth, company-pinned, paged (?limit, ?page). */
export async function GET(req: Request) {
  return readResource(req, "calls");
}

/** POST /api/v1/calls — upload a call for one of the company's reps (Engage plan E6; key scope "upload"). */
export async function POST(req: Request) {
  // The gate, here at the top: a live company key with the "upload" scope, inside its limits (401 / 403 / 429 otherwise).
  const caller = await authenticateApiKey(req, "upload", "/api/v1/calls");
  if (caller instanceof NextResponse) return caller;
  return uploadCall(req, caller);
}
