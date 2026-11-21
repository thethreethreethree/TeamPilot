import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { probeSupabase, type ProbeResult } from "@/lib/system/backendHealth";

/**
 * The IO half of backendHealth.ts, with per-instance caches.
 *
 * Every open tab polls /api/health (VersionWatcher, every 2 min), so the live checks must not run per request:
 * the Supabase probe at most once a minute, the storage measurement at most every 10 minutes. A serverless
 * instance is short-lived, so this caps load without holding a stale answer for long.
 *
 * Lives here, not in the route file, because a Next.js route.ts may only export HTTP handlers and route config —
 * the test reset below would fail the production build's route-export check.
 */

export type Usage = { storage_bytes: number; db_bytes: number };

const PROBE_TTL_MS = 60_000;
const USAGE_TTL_MS = 10 * 60_000;
let probeCache: { at: number; value: ProbeResult } | null = null;
let usageCache: { at: number; value: Usage | null } | null = null;

/** Test-only: clear the caches so each test sees a fresh check. */
export function resetBackendCheckCaches() {
  probeCache = null;
  usageCache = null;
}

export async function cachedProbe(now: number = Date.now()): Promise<ProbeResult> {
  if (probeCache && now - probeCache.at < PROBE_TTL_MS) return probeCache.value;
  const value = await probeSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
  probeCache = { at: now, value };
  return value;
}

/**
 * Bytes used, from public.system_storage_usage() (migration 0271). Null when it cannot be measured — no service
 * key, the migration not applied, or Supabase refusing — and null reads as level "unknown" (status "degraded"),
 * never as a false "ok".
 */
export async function cachedUsage(now: number = Date.now()): Promise<Usage | null> {
  if (usageCache && now - usageCache.at < USAGE_TTL_MS) return usageCache.value;
  let value: Usage | null = null;
  try {
    const { data, error } = await createAdminClient().rpc("system_storage_usage");
    const d = data as { storage_bytes?: unknown; db_bytes?: unknown } | null;
    if (!error && d) value = { storage_bytes: Number(d.storage_bytes), db_bytes: Number(d.db_bytes) };
    else if (error) console.error("[health] system_storage_usage failed:", error.message);
  } catch (e) {
    console.error("[health] system_storage_usage threw:", e);
  }
  usageCache = { at: now, value };
  return value;
}
