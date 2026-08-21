import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { uploadAssetBytes } from "@/lib/storage/assets";
import { pitchChunkObjectPath, isValidRecordingId } from "@/lib/coach/doorlog/pitchAudioChunks";

/**
 * POST /api/coach/sales-session/door-log/audio-chunk?rid=<recordingId>&seq=N — append one DoorLog pitch
 * recording chunk (Macro Mode "never lose the recording on a long call", founder 2026-08-22).
 *
 * The recorder uploads a ~15s chunk DURING recording so the audio is already in storage no matter how the
 * recording ends (long-call upload failure, phone-lock, backgrounding, never-Save). The worker stitches the
 * chunks on process. Mirrors the live path's /audio-chunk, adapted to the pitch flow: the chunks upload BEFORE
 * the pitch row exists, so there is no session/pitch to owner-check — the boundary is authenticated + the path
 * pinned to the CALLER'S OWN company (a rep can only ever write chunks under their company). The recordingId is
 * a client uuid whose SHAPE is validated so it cannot smuggle path segments.
 */

// A ~15s webm audio chunk is ~150-300 KB; cap generously so a malformed/oversized body can't be written.
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "door-log-audio-chunk", windowMs: 60_000, max: 240 });
  if (limited) return limited;

  const rid = req.nextUrl.searchParams.get("rid") ?? "";
  const seq = Number(req.nextUrl.searchParams.get("seq") ?? "");
  if (!isValidRecordingId(rid)) return NextResponse.json({ error: "Invalid recording id." }, { status: 400 });
  if (!Number.isInteger(seq) || seq < 0 || seq > 100_000) {
    return NextResponse.json({ error: "Invalid chunk seq." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return NextResponse.json({ error: "Empty chunk." }, { status: 400 });
  if (buf.byteLength > MAX_CHUNK_BYTES) return NextResponse.json({ error: "Chunk too large." }, { status: 413 });

  const storagePath = pitchChunkObjectPath(companyId, rid, seq);
  const res = await uploadAssetBytes({
    storagePath,
    bytes: buf,
    contentType: req.headers.get("content-type") || "audio/webm",
  });
  if (!res.ok) {
    // Idempotent on (rid, seq): a retry of an already-stored chunk returns "exists" → treat as success so a
    // best-effort retry never loses the durability it was meant to add.
    if (/exists|duplicate|already/i.test(res.error ?? "")) {
      return NextResponse.json({ ok: true, seq, deduped: true });
    }
    // CWE-209: log the raw storage error, return a generic message.
    console.error(`[door-log audio-chunk] upload failed rid=${rid} seq=${seq}:`, res.error);
    return NextResponse.json({ error: "Couldn't store the recording chunk." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, seq });
}
