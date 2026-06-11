import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/notifications
 *
 * Returns the current user's notification feed. Phase 1 sources:
 *   - mention.created events on the §3.1 chain where
 *     payload.target_user_id matches the caller.
 *
 * No notifications table — we derive directly from the chain. The
 * chain IS the source of truth (§3.1 data-as-asset); a side table
 * would duplicate state and introduce drift. A future Phase 2
 * source could derive task.assigned + decision.awaiting_read events
 * the same way.
 *
 * Read state is tracked client-side in localStorage for now (no UI
 * yet that needs server-side persistence). When we add cross-device
 * read-state we'll back it with `events.read_at` or similar.
 */
export async function GET() {
  if (!supabaseEnabled) {
    return NextResponse.json({ notifications: [] });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Pull recent mention.created events. RLS scopes by company so we
  // don't need to filter by company_id explicitly.
  const { data: events, error } = await supabase
    .from("events")
    .select("id, kind, subject, actor, payload, occurred_at")
    .eq("kind", "mention.created")
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userId = auth.user.id;
  // Filter to mentions targeting THIS user only. We do this in JS
  // because PostgREST jsonb filtering for nested fields with the
  // string match pattern is awkward, and 100-event pages are tiny.
  const mineRaw = (events ?? []).filter((e) => {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    return p.target_user_id === userId;
  });

  // Resolve actor display names for the mentions.
  const actorIds = Array.from(
    new Set(mineRaw.map((e) => e.actor).filter((a): a is string => !!a))
  );
  const nameById = new Map<string, string>();
  if (actorIds.length > 0) {
    const orFilter = actorIds.map((id) => `id.eq.${id}`).join(",");
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .or(orFilter);
    for (const p of profiles ?? []) {
      if (p.full_name) nameById.set(p.id, p.full_name);
    }
  }

  const notifications = mineRaw.map((e) => {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    return {
      id: e.id,
      kind: e.kind,
      subject: e.subject,
      actorId: e.actor,
      actorName: e.actor ? (nameById.get(e.actor) ?? "Someone") : "System",
      occurredAt: e.occurred_at,
      sourceKind: payload.source_kind ?? null,
      sourceId: payload.source_id ?? null,
      excerpt: payload.excerpt ?? null,
    };
  });

  return NextResponse.json({ notifications });
}
