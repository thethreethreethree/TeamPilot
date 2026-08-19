import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { deriveState } from "@/lib/schedule/deriveState";
import type { ScheduleEvent } from "@/lib/schedule/types";

/**
 * Schedule Management System — coverage requirements (Phase 5). A coverage requirement is the "no lapse"
 * rule the authority checks (min headcount for a day / time-window / role). It is EVENT-SOURCED
 * (COVERAGE_REQ_DEFINED), so POST appends the event and GET returns the derived requirements (replayed).
 * Manager-only.
 */
export const maxDuration = 30;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Body = z.object({
  appliesTo: z.enum(["day", "shift", "role"]),
  minHeadcount: z.number().int().nonnegative(),
  timeWindow: z.object({ start: hhmm, end: hhmm }).optional(),
  minByRole: z.record(z.string().min(1).max(60), z.number().int().nonnegative()).optional(),
});

type EventRow = { id: string; company_id: string; type: string; actor_id: string | null; payload: Record<string, unknown> | null; occurred_at: string; seq: number };

export async function GET(_req: NextRequest) {
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const sb = await createClient();
  try {
    const rows = await fetchAllPaged<EventRow>(
      (from, to) => sb.from("schedule_event").select("id, company_id, type, actor_id, payload, occurred_at, seq").eq("company_id", ctx.companyId).order("seq", { ascending: true }).range(from, to),
      { label: "schedule_event" },
    );
    const events: ScheduleEvent[] = rows.map((r) => ({ id: r.id, companyId: r.company_id, type: r.type as ScheduleEvent["type"], actorId: r.actor_id, payload: r.payload ?? {}, occurredAt: r.occurred_at, seq: r.seq }));
    return NextResponse.json({ requirements: Object.values(deriveState(events).coverageReqs) });
  } catch (e) {
    console.error("[schedule/coverage] read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load coverage requirements." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-coverage", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can set coverage." }, { status: 403 });

  const requirementId = crypto.randomUUID();
  const sb = await createClient();
  const { error } = await sb.rpc("append_schedule_event", {
    p_type: "COVERAGE_REQ_DEFINED",
    p_payload: {
      requirementId,
      appliesTo: body.appliesTo,
      minHeadcount: body.minHeadcount,
      ...(body.timeWindow ? { timeWindow: body.timeWindow } : {}),
      ...(body.minByRole ? { minByRole: body.minByRole } : {}),
    },
  });
  if (error) {
    console.error("[schedule/coverage] append failed:", error.message);
    return NextResponse.json({ error: "Couldn't save the coverage requirement." }, { status: 500 });
  }
  return NextResponse.json({ requirementId }, { status: 201 });
}
