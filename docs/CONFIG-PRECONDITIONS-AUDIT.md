# External-config precondition audit (2026-08-14)

Triggered by the password-recovery outage: a feature whose *code* was correct silently failed because an
**external config precondition** (Supabase Redirect-URLs allowlist / Site URL) was never verified. This audit
sweeps the codebase for the whole class — features whose correctness depends on config **outside the repo** — and
classifies each by **fail-mode**, because the danger is not "depends on config" (everything does) but "fails
**silently** when the config is wrong."

**The rule this audit enforces** (now constitutional — CLAUDE.md §1.5.3 / ThinkerThinker A41): a config-dependent
feature must either **fail LOUD** (a visible 5xx/health-flag/empty-with-notice a human will see) or have its
precondition **documented + verified** here. Silent dependence is the defect.

## Fixed by this change
- **Auth redirects (password recovery + signup confirmation).** Depend on Supabase Site URL + the Redirect-URLs
  allowlist. Were silent (reset links fell back to the marketing project). Now: every redirect is built from ONE
  canonical origin (`siteUrl()`), the config contract is written + has a verification procedure
  (`docs/AUTH-REDIRECTS.md`), and the canonical helpers are drift-guarded (`passwordRecovery.test.ts`).
  Auth-redirect surface confirmed complete: only recovery + signup use redirects (no OAuth / magic-link /
  email-change / code-exchange flows exist).

## Safe — fail LOUD (the pattern to copy)
- **Cron/sweep routes** (`CRON_SECRET`, `TASK_OVERRUN_SWEEP_SECRET`, `CARE_DURABILITY_SWEEP_SECRET`): return
  **503 "…is not set. …disabled until you configure it"** when unset. Visible, self-describing. ✅
- **LLM providers** (`DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`): `/api/health` reports `llmReady:false` +
  `providers.{deepseek,anthropic}:false`. Detectable. (Minor: `POST /api/llm/ping` 500s keyless in the
  standalone server instead of its documented 400 — cosmetic, noted in the Rizzemup port.)
- **Voice** (`ELEVENLABS_API_KEY`): surfaced by the `voice-health` route. Detectable.
- **`NEXT_PUBLIC_SITE_URL`**: has a production-safe fallback (`https://elostate.com`), so a missing var degrades
  to the correct canonical origin rather than a `localhost` leak (the 2026-08-02 SEO fix). ✅

## Still SILENT — same class, flagged (founder decisions)
1. **Web push (`VAPID_SUBJECT`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`).** If unset, a client
   **subscribes successfully but notifications never deliver** — no error the user or an operator sees. This is
   the recovery class exactly (already the open `push delivery diagnosis` item). **Recommended:** a health/diag
   surface that reports `pushConfigured:false` when the VAPID trio is incomplete, so the dependency fails visibly.
2. **Care inbound/outbound email (`POSTMARK_SERVER_TOKEN`, `CARE_EMAIL_HOST_DOMAIN`, `CARE_INBOUND_EMAIL_SECRET`).**
   Unset → send/receive silently no-ops (or the Postmark inbound webhook, configured in Postmark's dashboard,
   points nowhere). External-dashboard dependency like Supabase's. **Recommended:** report `emailConfigured` in
   health and document the Postmark webhook target as a precondition (a mini `AUTH-REDIRECTS.md` for email).

## Structural compounder
- **Two Vercel projects** (`team-pilot-…` = the app at `elostate.com`; `…-iota` = the marketing project). Env +
  auth config can be set on the wrong one — the direct compounder of the recovery outage
  (`reference_multiple_vercel_projects_env_drift`). Verify the target via `/api/health` `deploymentUrl` before
  trusting any dashboard/env change.

## Bottom line
The auth class is closed. Two silent-config surfaces remain (push, care-email) and are flagged for the founder as
health-visibility follow-ups — not built here, because each is a small deliberate add, but named so they can't
be mistaken for "working." The structural defense against a *future* instance is the amendment (A41): no
config-dependent feature ships "done" on a green build alone.
