import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { CONSTITUTION } from "@/lib/constitution";
import { emailConfigured } from "@/lib/care/email/configured";

/**
 * GET /api/health
 *
 * Honest, structured health check. Reports:
 *  - process uptime
 *  - which LLM providers have a key configured (does NOT call them — that
 *    would burn tokens per health check)
 *  - whether Supabase is configured
 *  - whether error reporting (Sentry) is switched on, server and browser
 *  - whether outbound email (Postmark) can send
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
      // Derived from raw env ON PURPOSE — do NOT replace with @/lib/llm's activeProviderName()/chooseProvider().
      // That module eagerly imports @/lib/env (validates at load), and this endpoint must return 200 describing a
      // broken LLM config, never 500 because of it. Mirrors chooseProvider's preference order (env, then deepseek,
      // then anthropic); see the note on activeProviderName() for why the coupling is deliberately avoided here.
      activeProvider:
        process.env.LLM_PROVIDER ??
        (llmProviders.deepseek
          ? "deepseek"
          : llmProviders.anthropic
          ? "anthropic"
          : null),
      // IS ANYONE TOLD WHEN SOMETHING BREAKS (2026-10-02). Production had no DSN, so Sentry never started and
      // every report to it was dropped, while comments said "Sentry keeps the exception"; the DeepSeek outage of
      // 2026-10-01 reached nobody. Founder picker 2026-10-02: turn Sentry on. This makes "is it on" checkable
      // with one curl instead of a guess (CLAUDE.md §1.5.3: fail loud on external config).
      // Mirrors the init guards term for term (§2.2): sentry.server.config.ts starts on
      // SENTRY_DSN ?? NEXT_PUBLIC_SENTRY_DSN; instrumentation-client.ts on NEXT_PUBLIC_SENTRY_DSN alone.
      errorReporting: {
        server: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
        browser: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      },
      // Whether email can send (the weekly digest, C.A.R.E email replies). The shared verdict, not a copy (2026-10-03).
      email: emailConfigured(),
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
