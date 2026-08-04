import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isMissingRelationError, type PostgrestLikeError } from "@/lib/coach/v5/migrationGuard";

/**
 * Widget load-event telemetry for the tenant's own settings page (was a "Sprint 7" stub).
 *
 * care_widget_load_events (0038) records every widget bootstrap outcome — and, importantly,
 * `origin_rejected` marks an attempt to use this tenant's embed token from a NON-allowed origin, i.e.
 * a stolen/guessed token being abused elsewhere. Surfacing it gives the admin security visibility
 * (§3.6 make-the-invisible-visible) rather than logging it into a black hole.
 *
 * The summary is a PURE function so its counting is unit-tested. The fetch STAYS LOUD on a genuine
 * error — it degrades to an empty summary ONLY for a pending-migration (table not yet created). A
 * transient DB error must NOT masquerade as "0 events / 0 rejected origins": that would hide the
 * security signal (origin_rejected = a stolen embed token used off-origin, section 3.6) behind a fake
 * calm, the error-as-no-data violation (section 3.4). The settings page already checks res.ok and renders a
 * setFailed branch, so a 500 shows an honest "couldn't load" — strictly better than a false zero.
 */

export type WidgetLoadResult =
  | "ok"
  | "origin_rejected"
  | "tenant_inactive"
  | "tenant_unknown"
  | "quota_exceeded";

export interface WidgetLoadEvent {
  id: string;
  origin: string | null;
  result: WidgetLoadResult;
  userAgent: string | null;
  createdAt: string;
}

export interface WidgetLoadEventsSummary {
  events: WidgetLoadEvent[];
  total: number;
  okCount: number;
  /** Wrong-origin attempts — the security signal (a token used off its allowed origins). */
  rejectedCount: number;
  /** Distinct non-allowed origins seen in `origin_rejected` events, most-recent first. */
  rejectedOrigins: string[];
}

/** Pure: fold a recent event list into the settings-page summary. */
export function summarizeLoadEvents(events: WidgetLoadEvent[]): WidgetLoadEventsSummary {
  const rejectedOrigins: string[] = [];
  let okCount = 0;
  let rejectedCount = 0;
  for (const e of events) {
    if (e.result === "ok") okCount += 1;
    if (e.result === "origin_rejected") {
      rejectedCount += 1;
      const o = e.origin?.trim();
      if (o && !rejectedOrigins.includes(o)) rejectedOrigins.push(o);
    }
  }
  return { events, total: events.length, okCount, rejectedCount, rejectedOrigins };
}

/** Recent widget load events for a tenant (most-recent first). Tenant-scoped by companyId. */
export async function fetchWidgetLoadEvents(
  companyId: string,
  limit = 50
): Promise<WidgetLoadEventsSummary> {
  try {
    const sb = await createServerClient();
    const { data, error } = await sb
      .from("care_widget_load_events")
      .select("id, origin, result, user_agent, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);
    // A PostgREST query error arrives in `error`, not as a throw — surface it so the catch can classify it.
    if (error) throw error;
    const events: WidgetLoadEvent[] = (data ?? []).map((r) => {
      const row = r as {
        id: string;
        origin: string | null;
        result: WidgetLoadResult;
        user_agent: string | null;
        created_at: string;
      };
      return {
        id: row.id,
        origin: row.origin,
        result: row.result,
        userAgent: row.user_agent,
        createdAt: row.created_at,
      };
    });
    return summarizeLoadEvents(events);
  } catch (e) {
    // Empty ONLY for a not-yet-migrated table; every genuine error stays loud (route → 500 → page setFailed).
    if (isMissingRelationError(e as PostgrestLikeError)) return summarizeLoadEvents([]);
    throw e;
  }
}
