import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { removeRecordingAudio } from "@/lib/coach/v5/removeRecordingAudio";
import {
  ERASURE_KINDS,
  ErasureInputError,
  identifierHash,
  maskedHint,
  normaliseIdentifier,
  type ErasureKind,
} from "@/lib/coach/remote/erasure";

/**
 * POST /api/coach/remote/erasure — erase one customer's data (RSS Phase 8, migration 0285; CLAUDE.md §3.1.1, AMD-014).
 * Company admins only.
 *   { action: "find", kind, value }              → the calls that customer is on, each with the matching line, to review.
 *   { action: "erase", kind, value, sessionIds } → erase the confirmed calls.
 *
 * ERASE, IN ORDER, AND WHY:
 *   1. The search runs again here. Only calls it returns may be erased — a request can never reach a call that does
 *      not mention this customer, whatever ids the client sends.
 *   2. The request is recorded with a keyed hash and a masked hint only (the identifier is never stored).
 *   3. The audio FILES go first. Once rss_erase_sessions clears the pointer, a file that failed to delete could never
 *      be found again; so any storage failure, or a pointer we cannot read, stops here with the database untouched.
 *   4. rss_erase_sessions deletes the words and blanks the rest in one transaction, and records the completion.
 *   5. An audit row: who asked, the masked hint, how many calls.
 */
const NOT_APPLIED = "Erasure is waiting on database migrations 0284 and 0285.";
const MISSING = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);

type Match = { session_id: string; started_at: string; agent_id: string; client_label: string | null; context: string; snippet: string | null };

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-erasure", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can erase a customer's data." }, { status: 403 });

  let b: { action?: unknown; kind?: unknown; value?: unknown; sessionIds?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const kind = (ERASURE_KINDS as readonly string[]).includes(String(b.kind)) ? (b.kind as ErasureKind) : null;
  if (!kind) return NextResponse.json({ error: "Search by phone, email or client name." }, { status: 400 });
  let normalised: string;
  try {
    normalised = normaliseIdentifier(kind, String(b.value ?? ""));
  } catch (e) {
    if (e instanceof ErasureInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const admin = createAdminClient();
  const { data: found, error: fErr } = await admin.rpc("rss_erasure_matches", { p_company: ctx.companyId, p_kind: kind, p_value: normalised });
  if (fErr) {
    if (MISSING.has(String(fErr.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    console.error(`[erasure] search failed company=${ctx.companyId}: ${fErr.message}`);
    return NextResponse.json({ error: "The search failed. Nothing was erased." }, { status: 500 });
  }
  const matches = (found ?? []) as Match[];

  if (b.action === "find") {
    const repIds = [...new Set(matches.map((m) => String(m.agent_id)))];
    const { data: reps } = repIds.length
      ? await admin.from("profiles").select("id, full_name").eq("company_id", ctx.companyId).in("id", repIds)
      : { data: [] };
    const names = new Map(((reps ?? []) as Array<{ id: string; full_name: string | null }>).map((r) => [String(r.id), r.full_name]));
    return NextResponse.json({
      hint: maskedHint(kind, normalised),
      capped: matches.length >= 200,
      matches: matches.map((m) => ({
        sessionId: m.session_id,
        startedAt: m.started_at,
        repName: names.get(String(m.agent_id)) ?? null,
        clientLabel: m.client_label,
        channel: m.context,
        line: m.snippet,
      })),
    });
  }

  if (b.action !== "erase") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const asked = Array.isArray(b.sessionIds) ? [...new Set(b.sessionIds.filter((x): x is string => typeof x === "string"))] : [];
  const allowed = new Set(matches.map((m) => String(m.session_id)));
  if (asked.length === 0) return NextResponse.json({ error: "Pick at least one call to erase." }, { status: 400 });
  if (asked.some((id) => !allowed.has(id))) {
    return NextResponse.json({ error: "Some of those calls don't mention this customer. Search again and pick from the results." }, { status: 400 });
  }

  let hash: string;
  try {
    hash = identifierHash(kind, normalised);
  } catch (e) {
    console.error("[erasure] cannot hash:", e);
    return NextResponse.json({ error: "Erasure isn't configured on this server. Nothing was erased." }, { status: 503 });
  }
  const hint = maskedHint(kind, normalised);
  const { data: request, error: rErr } = await admin
    .from("erasure_requests")
    .insert({ company_id: ctx.companyId, requested_by: ctx.userId, match_kind: kind, match_hash: hash, match_hint: hint })
    .select("id")
    .maybeSingle();
  if (rErr || !request) {
    if (rErr && MISSING.has(String(rErr.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    console.error(`[erasure] request insert failed company=${ctx.companyId}: ${rErr?.message}`);
    return NextResponse.json({ error: "Couldn't record the request. Nothing was erased." }, { status: 500 });
  }

  // Audio files first (see the header, step 3).
  const { data: withAudio, error: aErr } = await admin
    .from("coaching_sessions")
    .select("id, company_id, audio_asset_url")
    .eq("company_id", ctx.companyId)
    .in("id", asked)
    .not("audio_asset_url", "is", null);
  if (aErr) {
    console.error(`[erasure] audio lookup failed request=${request.id}: ${aErr.message}`);
    return NextResponse.json({ error: "Couldn't read the calls' recordings. Nothing was erased." }, { status: 500 });
  }
  let audioRemoved = 0;
  for (const s of (withAudio ?? []) as Array<{ id: string; company_id: string; audio_asset_url: string }>) {
    const r = await removeRecordingAudio(admin.storage, { audioAssetUrl: s.audio_asset_url, companyId: s.company_id, sessionId: s.id });
    if (!r.ok) {
      console.error(`[erasure] audio not removed session=${s.id} request=${request.id}: ${r.reason}`);
      return NextResponse.json(
        {
          error:
            r.reason === "malformed-pointer"
              ? "One call's recording is stored in a way this tool can't remove safely, so nothing was erased. Contact support."
              : "A recording couldn't be removed, so nothing else was erased. Try again.",
          audioRemovedBeforeStop: audioRemoved,
        },
        { status: r.reason === "malformed-pointer" ? 409 : 500 },
      );
    }
    audioRemoved += 1;
  }

  const { data: result, error: eErr } = await admin.rpc("rss_erase_sessions", {
    p_company: ctx.companyId,
    p_request: request.id,
    p_sessions: asked,
    p_by: ctx.userId,
  });
  if (eErr) {
    console.error(`[erasure] database erasure failed request=${request.id} (audio already removed: ${audioRemoved}): ${eErr.message}`);
    return NextResponse.json(
      { error: `The recordings were removed but the rest wasn't erased. Try again: it is safe to repeat.`, audioRemoved },
      { status: 500 },
    );
  }

  await recordAudit(admin, {
    companyId: ctx.companyId,
    actorId: ctx.userId,
    action: "erasure.request",
    objectType: "erasure_request",
    objectId: String(request.id),
    meta: { hint, kind, sessions: asked.length, audioRemoved, result },
  });
  return NextResponse.json({ erased: asked.length, audioRemoved, hint, result });
}
