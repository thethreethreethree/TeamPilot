import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { CONSTITUTION } from "@/lib/constitution";

/**
 * GET /api/health
 *
 * Honest, structured health check. Reports:
 *  - process uptime
 *  - which LLM providers have a key configured (does NOT call them — that
 *    would burn tokens per health check)
 *  - whether Supabase is configured
 *  - constitution version
 *  - node version
 *  - the exact DEPLOYED git commit (Vercel injects VERCEL_GIT_COMMIT_SHA/REF/ENV).
 *    This is the structural cure for the recurring "I don't see my updates" class
 *    (stale host / old deployment): `curl https://<host>/api/health` now names the
 *    exact commit a host is serving, so a stale domain is provable in one call
 *    instead of inferred. Commit SHA + branch are not secrets.
 *
 * Always returns HTTP 200 — the *contents* describe whether the system is
 * fully operational. A load balancer / monitor should look at the JSON, not
 * just the status code. The honest middle path: don't return 5xx for partial
 * configuration (demo mode is a legitimate state), don't return 200 with
 * lies either.
 *
 * No-cache headers so monitors always get fresh data.
 */
export async function GET() {
  const env = (process.env.NODE_ENV ?? "development") as
    | "development"
    | "production"
    | "test";
  const llmProviders = {
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  };
  const llmReady = llmProviders.deepseek || llmProviders.anthropic;

  const body = {
    status: "ok",
    constitution: {
      version: CONSTITUTION.version,
      amendments: CONSTITUTION.amendmentCount,
      lastAmendmentDate: CONSTITUTION.lastAmendmentDate,
    },
    mode: supabaseEnabled ? "live" : "demo",
    capabilities: {
      auth: supabaseEnabled,
      persistence: supabaseEnabled,
      llmReady,
      providers: llmProviders,
      activeProvider:
        process.env.LLM_PROVIDER ??
        (llmProviders.deepseek
          ? "deepseek"
          : llmProviders.anthropic
          ? "anthropic"
          : null),
    },
    runtime: {
      node: process.version,
      env,
      uptimeSeconds: Math.round(process.uptime()),
      now: new Date().toISOString(),
    },
    // Deployed build identity — lets any caller prove which commit a host serves.
    // Null locally / off-Vercel (the vars are only injected on Vercel builds).
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      commitShort: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      deploymentUrl: process.env.VERCEL_URL ?? null,
    },
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });
}
