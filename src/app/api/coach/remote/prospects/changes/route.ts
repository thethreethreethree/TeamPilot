import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { listProspects } from "@/lib/coach/remote/prospects";
import { openValueAt, pipelineChanges, summarize, type ProspectEvent } from "@/lib/coach/remote/pipelineChanges";

/**
 * GET /api/coach/remote/prospects/changes?repId=<id|team>&from=<ISO>&to=<ISO> — what changed in the pipeline in the period
 * (2026-11-23; pipelineChanges.ts; ledger F23.7). Read through the CALLER's client: the prospects they may see (their own,
 * a report's, or their tree for "team") and those prospects' full event history (needed to know each one's state before
 * the period). A failed read is a 500, never an empty week. `weeks=N` (2–12) adds `trend`: the open pipeline value at
 * `to` and at each of the N−1 earlier week boundaries (openValueAt), oldest first.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-prospect-changes", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const asked = sp.get("repId");
  if (asked && asked !== "team" && !UUID.test(asked)) return NextResponse.json({ error: "Unknown rep." }, { status: 400 });
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!ISO.test(from) || !ISO.test(to) || Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 93 * 86_400_000) {
    return NextResponse.json({ error: "Give a period of up to three months." }, { status: 400 });
  }
  const repId = asked === "team" ? undefined : asked || ctx.userId;
  const db = callerScopedDb(req) ?? (await createClient());
  const prospects = await listProspects(db, repId);
  if (prospects === null) return NextResponse.json({ error: "Couldn't load the pipeline." }, { status: 500 });
  const events: ProspectEvent[] = [];
  const ids = prospects.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const r = await fetchAllPagedResult<{ id: number; prospect_id: string; kind: string; value: Record<string, unknown> | null; created_at: string }>(
      (a, b) => db.from("remote_prospect_events").select("id, prospect_id, kind, value, created_at").in("prospect_id", chunk).order("id").range(a, b),
      { label: "prospect events" },
    );
    if (r.error) {
      console.error(`[prospect-changes] events read failed user=${ctx.userId}: ${r.error.message}`);
      return NextResponse.json({ error: "Couldn't load the pipeline's changes." }, { status: 500 });
    }
    for (const e of r.data ?? []) events.push({ id: Number(e.id), prospectId: String(e.prospect_id), kind: e.kind, value: e.value, at: e.created_at });
  }
  const changes = pipelineChanges(events, new Date(from).toISOString(), new Date(to).toISOString());
  const nameOf = new Map(prospects.map((p) => [p.id, p.name]));
  const weeks = Math.min(12, Math.max(0, Number(sp.get("weeks")) || 0));
  const trend = weeks >= 2 ? openValueAt(events, Array.from({ length: weeks }, (_, i) => new Date(Date.parse(to) - (weeks - 1 - i) * 7 * 86_400_000).toISOString())) : undefined;
  return NextResponse.json({ summary: summarize(changes), changes: changes.map((c) => ({ ...c, name: nameOf.get(c.prospectId) ?? null })), ...(trend ? { trend } : {}) });
}
