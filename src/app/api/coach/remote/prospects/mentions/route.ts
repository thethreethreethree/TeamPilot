import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { listProspects } from "@/lib/coach/remote/prospects";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";

/**
 * GET /api/coach/remote/prospects/mentions?repId= — for the CLOSED deals in a pipeline, which trackers were heard on each
 * deal's calls (2026-11-26, Gong ledger F20.10 "competitor mentions / any tracker mentioned vs not"). Same pipeline
 * scope as /api/coach/remote/prospects (own by default, a report's id, or "team").
 *
 * Every read goes through the CALLER's client: tracker hits follow the call's access (0276 rep or tree-allowed manager,
 * 0339 hidden calls), so a deal's mentions are only what this person may hear. Read on demand by the Sources view, not
 * on every pipeline load. Ids go in chunks of 150; a failed read is a 500, never "nothing was mentioned".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK = 150;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-prospect-mentions", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const asked = new URL(req.url).searchParams.get("repId");
  if (asked && asked !== "team" && !UUID.test(asked)) return NextResponse.json({ error: "Unknown rep." }, { status: 400 });
  const repId = asked === "team" ? undefined : asked || ctx.userId;
  const fail = (what: string, msg: string) => {
    console.error(`[prospect-mentions] ${what} failed: ${msg}`);
    return NextResponse.json({ error: "Couldn't load what was said on these deals." }, { status: 500 });
  };

  const prospects = await listProspects(db, repId);
  if (prospects === null) return fail("prospects", "listProspects");
  const closedIds = prospects.filter((p) => p.status === "won" || p.status === "lost").map((p) => p.id);
  if (closedIds.length === 0) return NextResponse.json({ mentions: {}, withCalls: [] });

  // Deal → its calls.
  const sessionsOf = new Map<string, string[]>();
  for (let i = 0; i < closedIds.length; i += CHUNK) {
    const { data, error } = await fetchAllPagedResult<{ prospect_id: string; session_id: string; id: number }>(
      (from, to) => db.from("remote_prospect_calls").select("prospect_id, session_id, id").in("prospect_id", closedIds.slice(i, i + CHUNK)).order("id", { ascending: true }).range(from, to),
      { label: "mention calls", maxRows: 100_000 },
    );
    if (error) return fail("calls", error.message);
    for (const r of data ?? []) sessionsOf.set(String(r.prospect_id), [...(sessionsOf.get(String(r.prospect_id)) ?? []), String(r.session_id)]);
  }
  const sessionIds = [...new Set([...sessionsOf.values()].flat())];

  // Each call's CURRENT transcript version — its newest stats version, as the adoption board reads it (review
  // 2026-11-26: a hit on an old version, e.g. a mis-hearing a re-transcription fixed, must not count). A call with no
  // stats row hasn't been analyzed, or isn't one this person may read: it neither mentions nor counts.
  const versionOf = new Map<string, number>();
  for (let i = 0; i < sessionIds.length; i += CHUNK) {
    const { data, error } = await fetchAllPagedResult<{ session_id: string; transcript_version: number; id: number }>(
      (from, to) => db.from("session_interaction_stats").select("session_id, transcript_version, id").in("session_id", sessionIds.slice(i, i + CHUNK)).order("id", { ascending: true }).range(from, to),
      { label: "mention versions", maxRows: 200_000 },
    );
    if (error) return fail("versions", error.message);
    for (const s of data ?? []) versionOf.set(String(s.session_id), Math.max(versionOf.get(String(s.session_id)) ?? 0, Number(s.transcript_version)));
  }

  // Call → trackers heard on its current transcript.
  const trackersOn = new Map<string, Set<string>>();
  const trackerIds = new Set<string>();
  const readable = sessionIds.filter((s) => versionOf.has(s));
  for (let i = 0; i < readable.length; i += CHUNK) {
    const { data, error } = await fetchAllPagedResult<{ session_id: string; tracker_id: string; transcript_version: number; id: number }>(
      (from, to) => db.from("tracker_hits").select("session_id, tracker_id, transcript_version, id").in("session_id", readable.slice(i, i + CHUNK)).order("id", { ascending: true }).range(from, to),
      { label: "mention hits", maxRows: 200_000 },
    );
    if (error) return fail("hits", error.message);
    for (const h of data ?? []) {
      const s = String(h.session_id);
      if (Number(h.transcript_version) !== versionOf.get(s)) continue;
      if (!trackersOn.has(s)) trackersOn.set(s, new Set());
      trackersOn.get(s)!.add(String(h.tracker_id));
      trackerIds.add(String(h.tracker_id));
    }
  }
  const nameOf = new Map<string, string>();
  const tids = [...trackerIds];
  for (let i = 0; i < tids.length; i += CHUNK) {
    const { data, error } = await db.from("keyword_trackers").select("id, name").in("id", tids.slice(i, i + CHUNK));
    if (error) return fail("tracker names", error.message);
    for (const t of (data ?? []) as Array<{ id: string; name: string }>) nameOf.set(String(t.id), t.name);
  }

  const mentions: Record<string, string[]> = {};
  // Deals with at least one analyzed call this person may read — the only deals that COULD have a mention, so the
  // only ones compared (review 2026-11-26: a deal with no readable call is not "not mentioned").
  const withCalls: string[] = [];
  for (const pid of closedIds) {
    const calls = (sessionsOf.get(pid) ?? []).filter((s) => versionOf.has(s));
    if (calls.length) withCalls.push(pid);
    const names = new Set<string>();
    for (const s of calls) for (const t of trackersOn.get(s) ?? []) if (nameOf.has(t)) names.add(nameOf.get(t)!);
    if (names.size) mentions[pid] = [...names].sort();
  }
  return NextResponse.json({ mentions, withCalls });
}
