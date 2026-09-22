import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { z } from "zod";

/**
 * One page of notifications.
 *
 * Module-scope and deliberately NOT exported — a Next route file may only export its HTTP
 * handlers and the framework's config keys, and an extra export is a build error rather than a
 * lint nit. Fifty also sits inside the mark-read body's `ids` ceiling of 100, so a client can
 * always name every row it was shown in one request.
 */
const PAGE = 50;

/**
 * Manager notifications (gamification Phase 4).
 *   GET  → the caller's notifications (newest first) + unread count. RLS scopes to recipient_id = the caller.
 *   POST → mark read: { all: true } or { ids: [...] }. The table is SELECT-only to clients (writes are
 *          service-role), so mark-read runs service-role but is pinned to recipient_id = the caller.
 */

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "gamification-notifications-list", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req); // web cookie OR mobile Bearer
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const supabase = callerScopedDb(req) ?? (await createClient());
  // RLS: recipient_id = auth.uid() — the caller reads only their own notifications.
  const { data, error, count } = await supabase
    .from("manager_notifications")
    .select("id, agent_id, session_id, type, payload, created_at, read_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notifications] list error:", error.message);
    return NextResponse.json({ error: "Couldn't load notifications." }, { status: 500 });
  }
  const rows = data ?? [];

  /**
   * THE UNREAD COUNT IS A SEPARATE COUNT OVER THE WHOLE TABLE, not a filter over this page.
   *
   * It used to be `rows.filter(r => r.read_at === null).length` — unread *within the newest
   * fifty*. That undercounts the moment a recipient has more than a page of notifications, and
   * the badge is the only signal that anything is waiting. Same defect class as the review queue
   * (0264): a limit applied before the filter that decides what the number means.
   *
   * Its own request rather than riding on the list's, because the list is not filtered to unread
   * and its `count` is therefore a different number.
   *
   * Best-effort: if the count fails, the list still renders. `null` is passed through rather than
   * substituting the page's own tally, which would be the undercount with a confident face on it.
   */
  const { count: unreadCount, error: unreadError } = await supabase
    .from("manager_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (unreadError) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notifications] unread count error:", unreadError.message);
  }

  return NextResponse.json({
    notifications: rows,
    /**
     * How many are unread in total. `null` when the count could not be read — the bell shows no
     * badge rather than a number it cannot stand behind.
     */
    unread: unreadCount ?? null,
    /**
     * How many exist in total, so a bounded list can say it is bounded. A NEW FIELD rather than a
     * changed shape: a browser holding an older bundle ignores what it has never heard of.
     */
    total: count ?? null,
  });
}


const MarkReadBody = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
]);

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "gamification-notifications-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req); // web cookie OR mobile Bearer
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
