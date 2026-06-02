import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { mockSignals } from "@/lib/mock-data";
import type { SignalRef } from "@/lib/diagnosis";

export type SignalsMode = "demo-fixtures" | "live-empty" | "live-data";

/**
 * Production signals fetcher. Same honesty contract as fetchTasks:
 *  - demo mode → fixtures with mode='demo-fixtures'
 *  - live + no rows → empty array with mode='live-empty'
 *  - live + rows → real signals with mode='live-data'
 *
 * In live mode, signals are derived automatically from events by the SQL
 * derive_signals_for_event() function fired by triggers (migrations 0002 + 0006).
 * The application does not insert signals directly except through that chain.
 */
export async function fetchSignals(args?: {
  limit?: number;
  sinceDays?: number;
}): Promise<{ signals: SignalRef[]; mode: SignalsMode }> {
  if (!supabaseEnabled) {
    return { signals: mockSignals as SignalRef[], mode: "demo-fixtures" };
  }

  const supabase = createClient();
  const limit = args?.limit ?? 200;
  let query = supabase
    .from("signals")
    .select("id, kind, source, observed_at, payload")
    .order("observed_at", { ascending: false })
    .limit(limit);

  if (args?.sinceDays) {
    const since = new Date();
    since.setDate(since.getDate() - args.sinceDays);
    query = query.gte("observed_at", since.toISOString());
  }

  const { data, error } = await query;
  if (error || !data) return { signals: [], mode: "live-empty" };

  const signals: SignalRef[] = data.map((r) => ({
    id: r.id,
    kind: r.kind,
    source: r.source,
    observed_at: r.observed_at,
    payload: r.payload ?? undefined,
  }));

  return { signals, mode: signals.length === 0 ? "live-empty" : "live-data" };
}
