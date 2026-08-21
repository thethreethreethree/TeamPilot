import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { uploadAssetBytes } from "@/lib/storage/assets";
import { chunkObjectPath } from "@/lib/coach/v5/stitchSessionAudio";

/**
 * POST /api/coach/sales-session/[id]/audio-chunk?seq=N — append one live-recording audio chunk.
 *
 * The "never lose the recording" durability layer (founder 2026-08-21): during a call the recorder uploads a
 * chunk every ~15s so the audio is already in storage no matter how the session ends (drop / tab-close /
 * phone-lock / crash / never-Stop). stitchSessionAudio concatenates them on finalize / auto-close. Additive:
 * a chunk failure never affects live capture or the transcript, and the clean-Stop full-blob persist still
 * works. Owner-only (mirrors /segments — the rep owns their own recording), service-role storage write pinned
 * to the caller's company, path never derived from caller input beyond the numeric seq.
 */

// A ~15s webm audio chunk is ~150-300 KB; cap generously so a malformed/oversized body can't be written.
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "sales-session-audio-chunk", windowMs: 60_000, max: 240 });
  if (limited) return limited;

  const { id } = await context.params;
  const seqRaw = req.nextUrl.searchParams.get("seq") ?? "";
  const seq = Number(seqRaw);
  if (!Number.isInteger(seq) || seq < 0 || seq > 100_000) {
    return NextResponse.json({ error: "Invalid chunk seq." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  // OWNER-ONLY: only the session's own rep uploads its recording chunks (mirrors /segments + /finalize).
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  }
  if (session.agentId !== auth.user.id) {
    return NextResponse.json({ error: "Only the session's own rep can upload its recording." }, { status: 403 });
  }

  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return NextResponse.json({ error: "Empty chunk." }, { status: 400 });
  if (buf.byteLength > MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: "Chunk too large." }, { status: 413 });
  }

  const storagePath = chunkObjectPath(companyId, id, seq);
  const res = await uploadAssetBytes({
    storagePath,
    bytes: buf,
    contentType: req.headers.get("content-type") || "audio/webm",
  });
  if (!res.ok) {
    // Idempotent on (session, seq): upsert:false means a retry of an already-stored chunk returns "exists" —
    // treat that as success (the chunk is safely there), never a hard failure that would lose the durability.
    if (/exists|duplicate|already/i.test(res.error ?? "")) {
      return NextResponse.json({ ok: true, seq, deduped: true });
    }
    // F7 (CWE-209): log the raw storage error, return a generic message.
    console.error(`[audio-chunk] upload failed session=${id} seq=${seq}:`, res.error);
    return NextResponse.json({ error: "Couldn't store the recording chunk." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, seq });
}
