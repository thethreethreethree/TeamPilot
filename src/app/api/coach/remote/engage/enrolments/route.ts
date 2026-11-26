import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { DEFAULT_OUTCOMES, outcomeAction, replayEnrolment, applyAction, FlowError, type Activity, type EnrolAction, type Step } from "@/lib/coach/remote/engage/flows";
import { EngageReadError, listEngage } from "@/lib/coach/remote/engage/today";

/**
 * /api/coach/remote/engage/enrolments — people in flows and their steps (plan E1, 0377; Gong F26.3 to-dos, F25.7–F25.9).
 *   GET ?scope=mine|team|<repId>&prospectId= → { items } — every enrolment the caller can see, at its current step.
 *   POST { action: "enrol", flowId, prospectId, contactId } — the deal's rep becomes the enrolment's rep. Refused when
 *        the contact asked not to be contacted on any flow (an opt-out ends all outreach, plan E2).
 *   POST { action: "step", enrolmentId, kind, outcome?, note? } — done / skipped / paused / resumed / removed / replied /
 *        meeting booked / opted out. A call step needs an outcome (F25.9); "Meeting booked" and "Asked not to be
 *        contacted" carry their effect on the enrolment (outcomeAction). The replay decides whether it applies.
 * Everything goes through the CALLER's client (0377's policies follow the deal's).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Kinds = ["complete_step", "skip_step", "pause", "resume", "remove", "replied", "meeting_booked", "opted_out"] as const;
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enrol"), flowId: z.string().regex(UUID), prospectId: z.string().regex(UUID), contactId: z.string().regex(UUID) }),
  z.object({ action: z.literal("step"), enrolmentId: z.string().regex(UUID), kind: z.enum(Kinds), outcome: z.string().regex(/^[a-z_]{1,40}$/).optional(), note: z.string().trim().max(1000).optional() }),
]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "engage-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const scope = req.nextUrl.searchParams.get("scope") || "mine";
  const prospectId = req.nextUrl.searchParams.get("prospectId");
  if ((scope !== "mine" && scope !== "team" && !UUID.test(scope)) || (prospectId && !UUID.test(prospectId))) return NextResponse.json({ error: "Unknown scope." }, { status: 400 });
  const db = callerScopedDb(req) ?? (await createClient());
  try {
    const items = await listEngage(db, { repId: prospectId ? undefined : scope === "team" ? undefined : scope === "mine" ? ctx.userId : scope, prospectId: prospectId ?? undefined });
    return NextResponse.json({ items, outcomes: DEFAULT_OUTCOMES, viewerId: ctx.userId });
  } catch (e) {
    if (!(e instanceof EngageReadError)) throw e;
    console.error(`[engage] read failed company=${ctx.companyId}: ${e.message}`);
    return NextResponse.json({ error: "Couldn't load your steps." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "engage-write", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());

  if (body.action === "enrol") {
    const { data: deal } = await db.from("remote_prospects").select("id, rep_id, company_id").eq("id", body.prospectId).maybeSingle();
    if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    // An opt-out anywhere ends all outreach to this person. Read with the service role, pinned to the caller's company:
    // the opt-out may sit on another rep's enrolment the caller can't see, and must still be honoured.
    const admin = createAdminClient();
    const { data: theirs, error: oErr } = await admin.from("engage_enrolments").select("id").eq("company_id", ctx.companyId).eq("contact_id", body.contactId).limit(200);
    if (oErr) return NextResponse.json({ error: "Couldn't check this person's history." }, { status: 500 });
    const ids = ((theirs ?? []) as Array<{ id: string }>).map((x) => x.id);
    if (ids.length) {
      const { count, error: cErr } = await admin.from("engage_activities").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId).in("enrolment_id", ids).eq("action", "opted_out");
      if (cErr) return NextResponse.json({ error: "Couldn't check this person's history." }, { status: 500 });
      if ((count ?? 0) > 0) return NextResponse.json({ error: "This person asked not to be contacted, so they can't be added to a flow." }, { status: 409 });
    }
    const { data, error } = await db.from("engage_enrolments").insert({ company_id: deal.company_id, flow_id: body.flowId, prospect_id: body.prospectId, contact_id: body.contactId, rep_id: deal.rep_id, created_by: ctx.userId }).select("id").single();
    if (error || !data) {
      if (error?.code === "23505") return NextResponse.json({ error: "This person is already in that flow." }, { status: 409 });
      console.error(`[engage] enrol failed deal=${body.prospectId}: ${error?.message}`);
      return NextResponse.json({ error: "Couldn't add them to the flow." }, { status: 500 });
    }
    return NextResponse.json({ id: String(data.id) });
  }

  // A step action: replay first, so the answer says when it doesn't apply (the replay would ignore it anyway).
  const { data: en } = await db.from("engage_enrolments").select("id, company_id, flow_id, created_at").eq("id", body.enrolmentId).maybeSingle();
  if (!en) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [{ data: flow, error: fErr }, { data: acts, error: aErr }] = await Promise.all([
    db.from("engage_flows").select("steps").eq("id", en.flow_id).maybeSingle(),
    db.from("engage_activities").select("step_index, action, created_at").eq("enrolment_id", en.id).order("id").limit(1000),
  ]);
  if (fErr || aErr || !flow) return NextResponse.json({ error: "Couldn't load this flow." }, { status: 500 });
  const steps = flow.steps as Step[];
  const history: Activity[] = ((acts ?? []) as Array<{ step_index: number; action: EnrolAction; created_at: string }>).map((a) => ({ stepIndex: a.step_index, action: a.action, createdAt: a.created_at }));
  const now = replayEnrolment(steps, en.created_at, history);
  const step = steps[now.stepIndex];
  let kind: EnrolAction = body.kind;
  if (body.kind === "complete_step" && step?.kind === "call") {
    if (!body.outcome || !DEFAULT_OUTCOMES.some((o) => o.key === body.outcome)) return NextResponse.json({ error: "Pick how the call went." }, { status: 400 });
    kind = outcomeAction(body.outcome); // a booked meeting finishes the enrolment; an opt-out removes it
  }
  try {
    applyAction(now.state, now.stepIndex, steps.length, kind);
  } catch (e) {
    if (e instanceof FlowError) {
      return NextResponse.json({ error: now.state === "paused" ? "This person's flow is paused — resume it first." : now.state === "active" ? "That doesn't apply to this step." : "This person's flow has ended." }, { status: 409 });
    }
    throw e;
  }
  const { error } = await db.from("engage_activities").insert({
    company_id: en.company_id, enrolment_id: en.id, step_index: now.stepIndex, action: kind,
    outcome: body.outcome ?? null, note: body.note || null, actor_id: ctx.userId,
  });
  if (error) {
    console.error(`[engage] step failed enrolment=${en.id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
