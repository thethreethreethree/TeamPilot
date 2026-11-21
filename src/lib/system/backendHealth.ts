/**
 * Is the backend actually answering, and how close is it to its plan's limits?
 *
 * WHY THIS EXISTS (2026-11-11). Users reported they could not log in. The Supabase project had been suspended
 * for `exceed_storage_size_quota`: every request — sign-in included — returned HTTP 402. Meanwhile /api/health
 * said `"status":"ok"` and `"auth":true`, because those fields only checked that the Supabase env vars EXIST.
 * Config presence was reported as service health, so the outage reached nobody until users complained
 * (CLAUDE.md §1.5.3: a dependency outside the repo must fail loud, not silent).
 *
 * Two questions, kept pure so both branches of every term are testable without a network:
 *   1. probeSupabase   — does the gateway sign-in uses actually answer? (one cheap GET of /auth/v1/settings)
 *   2. storageLevel    — how full are file storage and the database against the plan's quota?
 * and ONE verdict, overallStatus, that the route consumes rather than re-deriving (§2.2).
 */

export type ProbeResult = {
  /** True only on a 2xx from the Supabase gateway. */
  reachable: boolean;
  /** The HTTP status Supabase returned, or null when the request never completed (timeout / DNS / network). */
  httpStatus: number | null;
  /** Supabase's own message when it refused (e.g. the 402 restriction text), or the network error. */
  reason: string | null;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * GET <supabaseUrl>/auth/v1/settings with the anon key. Chosen because it goes through the same gateway as
 * sign-in (a restricted project 402s it exactly as it 402s /auth/v1/token), needs no table and no RLS, and
 * returns a few hundred bytes. Never throws: every failure becomes `reachable:false` with a reason.
 */
export async function probeSupabase(
  supabaseUrl: string,
  anonKey: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 4000,
): Promise<ProbeResult> {
  try {
    const res = await fetchImpl(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return { reachable: true, httpStatus: res.status, reason: null };
    let reason: string | null = null;
    try {
      const body = (await res.json()) as { message?: unknown; msg?: unknown };
      const m = body?.message ?? body?.msg;
      reason = typeof m === "string" ? m.slice(0, 300) : null;
    } catch {
      // A non-JSON error body: the status code alone still says it is down.
    }
    return { reachable: false, httpStatus: res.status, reason };
  } catch (e) {
    return { reachable: false, httpStatus: null, reason: e instanceof Error ? e.message.slice(0, 300) : "request failed" };
  }
}

export type StorageLevel = "ok" | "warn" | "critical" | "unknown";

/** Warn early enough to act (upgrade, or purge) before the hard stop; critical means days, not weeks. */
export const WARN_AT = 0.7;
export const CRITICAL_AT = 0.9;

/** Used / quota → a level. Anything non-finite or a non-positive quota is `unknown`, never a false `ok`. */
export function storageLevel(usedBytes: number | null, quotaBytes: number): { level: StorageLevel; pct: number | null } {
  if (usedBytes == null || !Number.isFinite(usedBytes) || usedBytes < 0 || !Number.isFinite(quotaBytes) || quotaBytes <= 0) {
    return { level: "unknown", pct: null };
  }
  const ratio = usedBytes / quotaBytes;
  const pct = Math.round(ratio * 1000) / 10; // one decimal
  if (ratio >= CRITICAL_AT) return { level: "critical", pct };
  if (ratio >= WARN_AT) return { level: "warn", pct };
  return { level: "ok", pct };
}

/**
 * Supabase FREE-plan included quotas. Used only when the env var is unset, and reported as such
 * (`quotaSource: "default-free-plan"`) so a reader knows the percentage is against an assumed plan.
 * After upgrading, set SUPABASE_STORAGE_QUOTA_BYTES / SUPABASE_DB_QUOTA_BYTES to the new plan's limits.
 */
export const FREE_PLAN_STORAGE_BYTES = 1024 ** 3; // 1 GB file storage
export const FREE_PLAN_DB_BYTES = 500 * 1024 ** 2; // 500 MB database

/** A positive integer byte count from env, else the fallback — and which one was used. */
export function quotaFromEnv(raw: string | undefined, fallback: number): { bytes: number; source: "env" | "default-free-plan" } {
  const n = raw == null || raw.trim() === "" ? NaN : Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? { bytes: Math.floor(n), source: "env" } : { bytes: fallback, source: "default-free-plan" };
}

export type OverallStatus = "ok" | "degraded" | "down";

/**
 * THE verdict. `down` = Supabase is configured but not answering (nobody can sign in) → the route returns 503.
 * `degraded` = it answers, but a quota is at warn/critical, or usage could not be measured. Demo mode (Supabase
 * not configured) is a legitimate state and stays `ok`, as before.
 */
export function overallStatus(args: {
  supabaseEnabled: boolean;
  probe: ProbeResult | null;
  levels: StorageLevel[];
}): OverallStatus {
  if (!args.supabaseEnabled) return "ok";
  if (!args.probe || !args.probe.reachable) return "down";
  if (args.levels.some((l) => l !== "ok")) return "degraded";
  return "ok";
}
