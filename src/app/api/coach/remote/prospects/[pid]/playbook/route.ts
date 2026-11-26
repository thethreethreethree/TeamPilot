import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { dealReviewCoach } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { numberedTranscript } from "@/lib/coach/remote/followThrough";
import { loadDealCalls } from "@/lib/coach/remote/revenue/dealCalls";
import {
  allowed, DEAL_REVIEW_SYSTEM, parseReview, replayNotes, reviewPrompt, REVIEW_CALLS, REVIEW_LINES,
  type Element, type NoteEvent,
} from "@/lib/coach/remote/revenue/playbook";

export const maxDuration = 90;

/**
 * /api/coach/remote/prospects/:pid/playbook — the deal's playbook notes and the AI Deal Reviewer (revenue Phase 3b,
 * 0373; Gong F20.6, F20.7).
 *   GET → { playbook, notes, canValidate } — the company's playbook and each element's current note (replayNotes).
 *   POST { action: "review" }                 — read the deal's latest calls (up to 5) and store evidence per element;
 *        { action: "write", element, note }    — a person's note;
 *        { action: "validate" | "clear", element }.
 * The deal and its calls are opened through the CALLER's client (prospects' and calls' RLS, the tree, hidden calls), so
 * the reviewer only reads calls this person may open. A person's note goes through the caller's client (0373's policy:
 * only the deal's rep or a manager the tree allows validates); the AI's read is written with the service role after
 * those reads, and only for elements it found evidence for (a cited line); the rest come back as "not found".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING = new Set(["PGRST205", "42P01", "42883"]);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("review") }),
  z.object({ action: z.literal("write"), element: z.number().int().min(0).max(9), note: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("validate"), element: z.number().int().min(0).max(9) }),
  z.object({ action: z.literal("clear"), element: z.number().int().min(0).max(9) }),
]);

type Db = ReturnType<typeof createAdminClient>;
type Playbook = { id: number; key: string; name: string; elements: Element[] };

async function load(db: Db, pid: string): Promise<{ deal: { id: string; rep_id: string; company_id: string } | null; playbook: Playbook | null; events: NoteEvent[] } | "missing" | null> {
  const { data: deal, error: dErr } = await db.from("remote_prospects").select("id, rep_id, company_id").eq("id", pid).maybeSingle();
  if (dErr) return null;
  if (!deal) return { deal: null, playbook: null, events: [] };
  const { data: pb, error: pErr } = await db.from("deal_playbook_current").select("id, key, name, elements").maybeSingle();
  if (pErr) return MISSING.has(String(pErr.code)) ? "missing" : null;
  if (!pb) return { deal, playbook: null, events: [] };
  const { data: ev, error: eErr } = await db
    .from("deal_element_notes")
    .select("element, action, note, ai, actor_id, created_at")
    .eq("prospect_id", pid)
    .eq("playbook_id", pb.id)
    .order("id", { ascending: true })
    .limit(1000);
  if (eErr) return null;
  const events = ((ev ?? []) as Array<{ element: number; action: NoteEvent["action"]; note: string | null; ai: NoteEvent["ai"]; actor_id: string; created_at: string }>).map((e) => ({
    element: e.element, action: e.action, note: e.note, ai: e.ai, actorId: e.actor_id, at: e.created_at,
  }));
  return { deal, playbook: { id: Number(pb.id), key: String(pb.key), name: String(pb.name), elements: pb.elements as Element[] }, events };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const limited = rateLimit(req, { id: "remote-deal-playbook", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { pid } = await params;
  if (!UUID.test(pid)) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  const db = (callerScopedDb(req) ?? (await createClient())) as unknown as Db;
  const r = await load(db, pid);
  if (r === "missing") return NextResponse.json({ available: false });
  if (!r) return NextResponse.json({ error: "Couldn't load this deal's playbook." }, { status: 500 });
  if (!r.deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  if (!r.playbook) return NextResponse.json({ available: true, playbook: null, notes: [] });
  // The policy decides who validates; this only says whether to show the button: the deal's rep, or a manager / admin
  // (who can only see this deal at all if the tree allows it).
  const lead = r.deal.rep_id === ctx.userId || ctx.isAdmin || (await db.rpc("is_sales_coach_manager")).data === true;
  return NextResponse.json({
    available: true,
    playbook: { key: r.playbook.key, name: r.playbook.name, elements: r.playbook.elements },
    notes: replayNotes(r.events, r.playbook.elements.length),
    canValidate: lead,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const limited = rateLimit(req, { id: "remote-deal-playbook-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { pid } = await params;
  if (!UUID.test(pid)) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  const db = (callerScopedDb(req) ?? (await createClient())) as unknown as Db;
  const r = await load(db, pid);
  if (r === "missing") return NextResponse.json({ error: "Playbooks are waiting on database migration 0373." }, { status: 503 });
  if (!r) return NextResponse.json({ error: "Couldn't load this deal's playbook." }, { status: 500 });
  if (!r.deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  if (!r.playbook) return NextResponse.json({ error: "Your company hasn't chosen a playbook yet." }, { status: 409 });
  const pb = r.playbook;
  const views = replayNotes(r.events, pb.elements.length);

  if (body.action !== "review") {
    const v = views[body.element];
    if (!v) return NextResponse.json({ error: "That element isn't on the playbook." }, { status: 400 });
    if (!allowed(v.state, body.action)) {
      return NextResponse.json({ error: body.action === "validate" ? "Write the note first, then validate it." : "That change doesn't apply to this note." }, { status: 409 });
    }
    const { error } = await db.from("deal_element_notes").insert({
      company_id: r.deal.company_id, prospect_id: pid, playbook_id: pb.id, element: body.element, action: body.action,
      note: body.action === "write" ? body.note : null, actor_id: ctx.userId,
    });
    if (error) {
      if (error.code === "42501") return NextResponse.json({ error: "Only the deal's rep or their manager can validate a note." }, { status: 403 });
      console.error(`[deal-playbook] note failed deal=${pid}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't save that note." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // The reviewer: the deal's latest calls the caller may open, newest first (dealCalls.ts, through the caller's client).
  const dc = await loadDealCalls(db as never, pid, { maxCalls: REVIEW_CALLS, maxLines: REVIEW_LINES });
  if (dc === "failed") return NextResponse.json({ error: "Couldn't read this deal's calls." }, { status: 500 });
  if (!dc.linked) return NextResponse.json({ error: "Link calls to this deal first — the reviewer reads its calls." }, { status: 409 });
  const calls = dc.calls;
  if (!calls.length) return NextResponse.json({ error: "This deal's calls have no transcripts to review yet." }, { status: 409 });
  const ai = await dealReviewCoach({
    companyId: ctx.companyId,
    systemPrompt: DEAL_REVIEW_SYSTEM + CONVERSATION_IS_DATA,
    userMessage: reviewPrompt(pb.elements, calls, numberedTranscript),
    sessionId: calls[0]!.sessionId,
  });
  if (ai.suppressed) return NextResponse.json({ error: "The coach isn't answering on this account right now." }, { status: 409 });
  const reads = ai.text.trim() ? parseReview(ai.text, pb.elements, calls) : null;
  if (!reads) return NextResponse.json({ error: "The review didn't come back usable — try again." }, { status: 502 });
  // Store only evidence (a cited line), and only where the note's state allows a new read (replayNotes is the rule).
  const rows = reads
    .map((read, element) => ({ read, element }))
    .filter(({ read, element }) => read.cites.length > 0 && allowed(views[element]!.state, "ai_suggest"))
    .map(({ read, element }) => ({ company_id: r.deal!.company_id, prospect_id: pid, playbook_id: pb.id, element, action: "ai_suggest", ai: read, actor_id: ctx.userId }));
  if (rows.length) {
    const { error } = await createAdminClient().from("deal_element_notes").insert(rows);
    if (error) {
      console.error(`[deal-playbook] review store failed deal=${pid}: ${error.message}`);
      return NextResponse.json({ error: "The review ran but couldn't be saved — try again." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, found: rows.length, of: pb.elements.length, calls: calls.length });
}
