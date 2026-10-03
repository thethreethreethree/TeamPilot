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

## Appended 2026-10-02 — error reporting, and what production actually has set

Production's environment (`vercel env ls production --project team-pilot`, names only) holds 10 variables:
`NEXT_PUBLIC_MEETING_COACH_ENABLED CRON_SECRET ELEVENLABS_API_KEY NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY
VAPID_SUBJECT NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SUPABASE_URL DEEPSEEK_API_KEY`.
Against this audit:

- **Error reporting (Sentry) was SILENT and OFF.** No `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`, so
  `sentry.server.config.ts` and `instrumentation-client.ts` never called `Sentry.init`, every capture was dropped,
  and code comments saying "Sentry keeps the exception" were untrue in production. The DeepSeek outage of
  2026-10-01 reached nobody. Founder picker 2026-10-02: turn Sentry on. Now **loud**: `/api/health` reports
  `capabilities.errorReporting.{server,browser}`, and an AI outage sends one Sentry message per outage.
  **Blocking setup step (founder):**
  1. Create a Sentry project (platform: Next.js) and copy its DSN.
  2. In Vercel, project `team-pilot`, Production: add `NEXT_PUBLIC_SENTRY_DSN` = the DSN. One variable covers both
     sides: the server config falls back to it. A DSN is public by design. It is baked in at build time, so
     redeploy after adding it.
  3. Verify: `curl -s https://elostate.com/api/health` shows `"errorReporting":{"server":true,"browser":true}`.
  4. Verify delivery: the first real server error, or the next AI outage, appears in the Sentry project.
- **Care email (`POSTMARK_SERVER_TOKEN`, …): still unset in production**, so item 2 above is still silent.
- **Cron secrets:** every scheduled route in `vercel.json` now checks `CRON_SECRET` (set). The separate
  `TASK_OVERRUN_SWEEP_SECRET` and `CARE_DURABILITY_SWEEP_SECRET` named above are no longer read by the cron
  routes (checked 2026-10-02), so their absence disables nothing.
- **The second Vercel project** named under "Structural compounder" was a different one (`…-iota`, marketing);
  a duplicate app project, `team-pilot-6wlo`, was deleted on 2026-10-01 (founder's pick).

## Appended 2026-10-03 — email (Postmark): the weekly digest has never sent

The weekly digest the founder asked for on 2026-09-04 (managers: a team rollup; reps: their own progress) is
email-only, and production has no `POSTMARK_SERVER_TOKEN` or `CARE_EMAIL_HOST_DOMAIN`. Every Monday run answers 200
and sends nothing; the 2026-09-28 run logged "Postmark not configured … no email sent". Nothing else live depends on
email (all 63 C.A.R.E conversations are `web_widget`). Founder picker 2026-10-03: set up Postmark. Now **loud**:
`/api/health` → `capabilities.email`, from the one verdict `emailConfigured()` (src/lib/care/email/configured.ts).

**Blocking setup step (founder):**
1. postmarkapp.com: create an account and a **Server** (e.g. "ELOSTATE"). Copy its **Server API token**.
2. In Postmark → Sender Signatures → **Domains**, add the sending domain, for example `mail.elostate.com`. Postmark
   shows a **DKIM** TXT record and a **Return-Path** CNAME; add both at the DNS host for elostate.com and press
   Verify. Mail goes out as `notifications@<that domain>`.
3. New Postmark accounts start in test mode and can only send inside the verified domain until Postmark approves the
   account; request approval in the dashboard so reps' addresses receive it.
4. Vercel, project `team-pilot`, Production: `POSTMARK_SERVER_TOKEN` = the token (secret) and
   `CARE_EMAIL_HOST_DOMAIN` = the verified domain. Redeploy.
5. Verify: `curl -s https://elostate.com/api/health` shows `"email":true`. Then the next Monday run (13:00 UTC)
   logs sends instead of "Postmark not configured", and a manager's inbox has the digest.
