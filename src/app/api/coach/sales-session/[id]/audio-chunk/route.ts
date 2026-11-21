import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { uploadAssetBytes } from "@/lib/storage/assets";
import { chunkObjectPath } from "@/lib/coach/v5/stitchSessionAudio";
import { createAdminClient } from "@/lib/supabase/admin";

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

// Chunk 0's recStart may sit at most this far from the server's started_at: it is the browser's clock, so allow skew,
// but a recorder an hour off the session is not a recorder start.
const MAX_REC_START_SKEW_MS = 60 * 60 * 1000;

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
  if (seq === 0) await recordAudioStart(req, id, companyId, session.startedAt);
  return NextResponse.json({ ok: true, seq });
}

/**
 * Chunk 0 carries recStart: when the recorder started, on the browser clock every spokenAt uses. Stored once as
 * coaching_sessions.audio_started_at (0300) so spoken_at − audio_started_at is the true position in the audio — the
 * base audioBaseIso / rss_line_trimmed use, so a trim hides the right lines on a recorder that started late. Best-effort:
 * the chunk is already stored; a missing or implausible value leaves started_at as the base, exactly as before.
 * Service role (0300 refuses a direct write by the rep, so the clock cannot be slid to un-hide a trim); only while unset.
 */
async function recordAudioStart(req: NextRequest, sessionId: string, companyId: string, startedAt: string): Promise<void> {
  const raw = Number(req.nextUrl.searchParams.get("recStart") ?? "");
  const base = Date.parse(startedAt);
  if (!Number.isInteger(raw) || raw <= 0 || !Number.isFinite(base) || Math.abs(raw - base) > MAX_REC_START_SKEW_MS) return;
  try {
    const { error } = await createAdminClient()
      .from("coaching_sessions")
      .update({ audio_started_at: new Date(raw).toISOString() })
      .eq("id", sessionId)
      .eq("company_id", companyId)
      .is("audio_started_at", null);
    // Before 0300 the column does not exist (42703 / PGRST204): the old base still applies, nothing to report.
    if (error && !["42703", "PGRST204"].includes(String((error as { code?: unknown }).code ?? ""))) {
      console.error(`[audio-chunk] audio start not recorded session=${sessionId}: ${error.message}`);
    }
  } catch (err) {
    console.error(`[audio-chunk] audio start not recorded session=${sessionId}:`, err);
  }
}

