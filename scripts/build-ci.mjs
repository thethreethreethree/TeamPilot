#!/usr/bin/env node
//
// scripts/build-ci.mjs — reproduce CI's Build step LOCALLY: a "secretless" `next build`.
//
// Why this exists
// ───────────────
//   CI runs `next build` with NO secrets (no .env.local, no LLM/Supabase/Sentry vars). A dev machine builds
//   WITH .env.local, and Vercel builds WITH its env — so a change can pass `npm run build` locally AND deploy
//   green on Vercel yet STILL fail CI's Build step. That exact divergence kept CI chronically red and unnoticed
//   for weeks (2026-08-04): env.ts threw at module-eval without an LLM key, and several pages failed to
//   prerender without a Suspense boundary — neither visible in a with-secrets build. `npm run check` doesn't
//   catch it either (it has no build step). This script closes that gap: it hides the local env files + strips
//   the secret vars, runs the build exactly as CI sees it, and ALWAYS restores your env files.
//
// Usage
// ─────
//   npm run build:ci      # run before pushing a change that touches build-time module eval, prerendering, or env
//
// Exit code: 0 if the secretless build passes (CI Build will pass), 1 otherwise.

import { execSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

// Local env files a dev has but CI does not. (.env / .env.example are committed + safe to leave.)
const ENV_FILES = [".env.local", ".env.production.local", ".env.development.local"];

// Secrets that, if present in the SHELL env, would defeat the reproduction by making the build pass.
const SECRET_VARS = [
  "DEEPSEEK_API_KEY",
  "ANTHROPIC_API_KEY",
  "LLM_PROVIDER",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SENTRY_AUTH_TOKEN",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_DEFAULT_VOICE_ID",
];

const SUFFIX = ".ci-repro-bak";
const moved = [];

function restore() {
  for (const f of moved.splice(0)) {
    try {
      if (existsSync(f + SUFFIX)) renameSync(f + SUFFIX, f);
    } catch (e) {
      console.error(`⚠ Could not restore ${f} — do it manually: rename ${f}${SUFFIX} → ${f}`, e);
    }
  }
}

// Self-heal: if a previous run was hard-killed and left a backup while the real file is gone, restore it first.
for (const f of ENV_FILES) {
  if (existsSync(f + SUFFIX) && !existsSync(f)) {
    try {
      renameSync(f + SUFFIX, f);
    } catch {
      /* leave it for manual recovery */
    }
  }
}

// Restore on interrupt too, so a Ctrl-C never leaves your .env.local hidden.
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restore();
  process.exit(143);
});

try {
  for (const f of ENV_FILES) {
    if (existsSync(f)) {
      renameSync(f, f + SUFFIX);
      moved.push(f);
    }
  }
  const env = { ...process.env };
  for (const v of SECRET_VARS) delete env[v];

  console.log(
    "▶ Reproducing CI's Build step: secretless `next build` " +
      `(hidden: ${moved.join(", ") || "none"}; secrets stripped from env)…\n`
  );
  // `npm run build` (not `next build` directly) so the prebuild hook runs too — matches CI exactly.
  execSync("npm run build", { stdio: "inherit", env, shell: true });
  restore();
  console.log(
    "\n✅ Secretless build PASSED — CI's Build step will pass with this change."
  );
} catch {
  restore();
  console.error(
    "\n❌ Secretless build FAILED — this is exactly what CI's Build step sees (it has no secrets).\n" +
      "   A module throwing at build-time on a missing runtime secret, or a page using useSearchParams()\n" +
      "   without a Suspense boundary, are the usual causes. Fix before pushing."
  );
  process.exitCode = 1;
}
