# Ops — Environment Variable Checklist (verify in the `team-pilot` Vercel project)

> Generated 2026-08-09 during the post-voice-outage health check. The voice outage happened because
> `ELEVENLABS_API_KEY` was set on the **wrong Vercel project** (`team-pilot-6wlo` instead of `team-pilot`,
> which serves `elostate.com`). Walk this list in **`team-pilot` → Settings → Environment Variables**
> (Production) to confirm nothing else drifted. Confirm the project first: its **Domains** must include
> `elostate.com`, or `curl https://elostate.com/api/health` → `build.deploymentUrl` starts `team-pilot-…`.
>
> `env.ts` HARD-REQUIRES only an LLM key + the Supabase pair (app throws at startup without them). Everything
> else **degrades gracefully** — meaning a missing key doesn't crash the app, the feature just silently
> stops working. That silence is the risk this list guards against.

## Required — app won't function without these (all ✅ live-verified 2026-08-09)
| Var | Powers | Status |
|---|---|---|
| `DEEPSEEK_API_KEY` | Primary LLM (all AI: coach, C.A.R.E, dissect, reviews) | ✅ `/api/health` → `deepseek:true` |
| `NEXT_PUBLIC_SUPABASE_URL` | Database + auth | ✅ `auth:true, persistence:true` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client DB access | ✅ (must be set WITH the URL — env.ts enforces the pair) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin/service-role DB writes | ✅ persistence works |

## Feature keys — set or the feature SILENTLY no-ops (no crash, no error to the user)
| Var | Powers | Verify |
|---|---|---|
| `ELEVENLABS_API_KEY` | Voice: live coaching STT, recording transcription, Jeff's TTS. **Must be the `sk_…` key, NOT the hex ID.** | ✅ fixed today — but confirm it's the `sk_dba4…` value in `team-pilot` |
| `ELEVENLABS_DEFAULT_VOICE_ID` | Jeff's voice id (optional — has a hardcoded default) | optional |
| `ANTHROPIC_API_KEY` | LLM **failover** when DeepSeek is down. `/api/health` shows `anthropic:false` = unset. | ⚠️ set for resilience (must start `sk-ant-`), or accept no LLM fallback |
| `POSTMARK_SERVER_TOKEN` | Outbound email (report delivery cron, notifications). Missing → `outbound.ts` skips sending. | ⚠️ verify set |
| `CARE_EMAIL_HOST_DOMAIN` | Email sending domain | verify if email used |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web-push delivery (known open: subscribes but doesn't deliver) | ⚠️ the 3 VAPID vars |

## Secrets — protect crons/webhooks (missing → the job fails auth or runs unguarded)
| Var | Powers | Verify |
|---|---|---|
| `CRON_SECRET` | Auth for the 7 Vercel crons (durability sweep, dissect backfill, task-overrun, finance report, RCD retention, recording purge, KPI compute) | ⚠️ verify set — a cron that 401s silently stops maintaining data |
| `CARE_DURABILITY_SWEEP_SECRET` | Durability-sweep cron auth | verify |
| `TASK_OVERRUN_SWEEP_SECRET` | Task-overrun cron auth | verify |
| `CARE_INBOUND_EMAIL_SECRET` | Inbound-email webhook auth | verify if inbound email used |

## Config — behavior, not secrets
| Var | Powers | Note |
|---|---|---|
| `LLM_PROVIDER` | Force `deepseek`/`anthropic` (else auto-selects). If set, its key MUST exist. | leave unset to auto-select |
| `DEEPSEEK_MODEL` / `ANTHROPIC_MODEL` | Model overrides | optional (defaults) |
| `CARE_DEFAULT_TENANT_ID` | C.A.R.E default tenant | verify if used |
| `NEXT_PUBLIC_SITE_URL` | Absolute links / redirects | should be `https://elostate.com` |
| `NEXT_PUBLIC_BOOKING_URL` | Booking CTA link | optional |
| `RCD_RETENTION_DAYS` | RCD media retention window | optional (default) |
| `NEXT_PUBLIC_CARE_EXTENSION_ID` / `NEXT_PUBLIC_SALES_EXTENSION_ID` | Extension token pinning | **intentionally UNSET until Chrome Web Store launch** (setting early breaks sideloaded sign-in) |

## Dev/test/build only — ignore in prod
`EXECOS_ALLOW_SEED`, `EXECOS_INTEGRATION_TEST`, `NEXT_PHASE` (Next sets this during build).

---

**The permanent fix for the whole class:** consolidate to ONE Vercel project. If `team-pilot-6wlo`'s
**Domains** list has nothing real (only a `*.vercel.app` URL), delete/disconnect it so this repo deploys to
`team-pilot` only — then env vars can never drift between projects again. Verify its Domains before deleting.
