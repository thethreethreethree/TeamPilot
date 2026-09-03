import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { z } from "zod";

/**
 * Manager notifications (gamification Phase 4).
 *   GET  → the caller's notifications (newest first) + unread count. RLS scopes to recipient_id = the caller.
 *   POST → mark read: { all: true } or { ids: [...] }. The table is SELECT-only to clients (writes are
 *          service-role), so mark-read runs service-role but is pinned to recipient_id = the caller.
 */

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "gamification-notifications-list", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const supabase = await createClient();
  // RLS: recipient_id = auth.uid() — the caller reads only their own notifications.
  const { data, error } = await supabase
    .from("manager_notifications")
    .select("id, agent_id, session_id, type, payload, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notifications] list error:", error.message);
    return NextResponse.json({ error: "Couldn't load notifications." }, { status: 500 });
  }
  const rows = data ?? [];
  const unread = rows.filter((r) => r.read_at === null).length;
  return NextResponse.json({ notifications: rows, unread });
}

const MarkReadBody = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
]);

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "gamification-notifications-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, MarkReadBody);
  if (body instanceof NextResponse) return body;

  // Service-role write, but PINNED to recipient_id = the caller so no one can mark another's notifications.
  const admin = createAdminClient();
  let q = admin
    .from("manager_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", ctx.userId)
    .is("read_at", null);
  if ("ids" in body) q = q.in("id", body.ids);
  const { error } = await q;
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notifications] mark-read error:", error.message);
    return NextResponse.json({ error: "Couldn't update notifications." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
