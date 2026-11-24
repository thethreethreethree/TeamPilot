import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";

/**
 * POST /api/coach/remote/:id/send-to-crm — "Send to CRM" on a call's Highlights (2026-11-24, migration 0330; General
 * Sales Interface PDF "API integration (SalesForce/whatever platform the company uses)"; founder picker "Company
 * webhook"). Whoever can open the call (getSession through the caller's client: the rep, or a manager in the tree)
 * queues a call.to_crm delivery to each of the company's webhook endpoints that take that event. The queue holds only
 * the call's id; the send job assembles the brief, next steps, follow-up and prospect at send time (crmExport.ts).
 *   → { queued: N } · 409 when the company has no endpoint for it (an admin adds one in Protection → Webhooks).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "send-to-crm", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const session = await getSession(id, callerScopedDb(req) ?? (await createClient()));
  if (!session || session.companyId !== ctx.companyId) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!isRemoteContext(session.context) || !isSalesCall(session.sessionKind)) return NextResponse.json({ error: "Only a phone or video sales call can be sent to the CRM." }, { status: 409 });
  if (session.status === "active") return NextResponse.json({ error: "This call is still live. Send it once it has ended." }, { status: 409 });

  const admin = createAdminClient();
  const { data: queued, error } = await admin.rpc("rss_webhook_enqueue", { p_company: ctx.companyId, p_event: "call.to_crm", p_payload: { sessionId: id, sentBy: ctx.userId } });
  if (error) {
    console.error(`[send-to-crm] enqueue failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't send it. Try again." }, { status: 500 });
  }
  const n = Number(queued) || 0;
  if (n === 0) return NextResponse.json({ error: "Your company hasn't connected a CRM yet. An admin adds one in Remote Sales → Protection → Webhooks (choose \"A call is sent to your CRM\")." }, { status: 409 });
  await recordAudit(admin, { companyId: ctx.companyId, actorId: ctx.userId, action: "session.export", objectType: "coaching_session", objectId: id, meta: { to: "crm", endpoints: n } });
  return NextResponse.json({ queued: n });
}
