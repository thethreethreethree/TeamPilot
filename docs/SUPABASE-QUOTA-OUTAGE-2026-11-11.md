# Supabase quota suspension — nobody could sign in (2026-11-11)

## What users saw
"Our users have trouble logging in." Every sign-in failed.

## What was actually wrong (observed, not inferred)
Every request to Supabase project `phjohvxznvmxsxybyuqq` — the one `elostate.com` uses (confirmed from the live
login page's bundle) — returned:

```
HTTP 402
{"message":"Service for this project is restricted due to the following violations: exceed_storage_size_quota.
The project owner must upgrade their plan or remove spend caps to restore service."}
```

Checked on `/auth/v1/settings`, `/rest/v1/profiles`, and a password sign-in for a nonexistent account (which a
working project answers with 400 "invalid credentials"). All three: 402. No login code had changed since
2026-09-19; production was serving the current commit `0214913`.

## Why nobody knew until users complained
`/api/health` reported `"status":"ok"` and `"auth":true` during the suspension. `auth` was `supabaseEnabled` —
whether the env vars **exist** — not whether Supabase **answers**. Production also has Sentry off and email off
(`errorReporting:false`, `email:false` on the same endpoint), so there was no channel for an alert anyway.

## Why storage filled (likely; confirm in the Supabase dashboard → Usage)
The API was blocked, so bucket sizes could not be measured here. The largest writer by design is sales-call
audio in `assets-v1`:
- `recording-purge-cron` keeps each rep's **last 20** unsaved recordings, and saved recordings forever.
- Migration `0241` raised the per-file limit from 25 MB to **250 MB** for long recordings.
- The free plan includes **1 GB** of file storage.

The retention rule is a count per rep with no relation to the plan's quota, so growth in reps or call length
reaches the cap with no warning. Other writers: `care-rcd-media` (RCD, 90-day retention), `widget-logos`, `files`.

## Restoring service
Founder action, in the Supabase dashboard: upgrade the plan or remove the spend cap. No code change or redeploy
is needed; sign-in returns when the restriction lifts. Then set `SUPABASE_STORAGE_QUOTA_BYTES` /
`SUPABASE_DB_QUOTA_BYTES` on Vercel to the new plan's limits (see `.env.example`).

## What changed in the code
- `/api/health` now probes Supabase (`src/lib/system/backendHealth.ts`, `liveBackendChecks.ts`): unreachable →
  **HTTP 503, `status:"down"`**, with Supabase's own reason. Cached 60 s per instance.
- Migration `0271` adds `public.system_storage_usage()` (service-role only). Health reports file storage and
  database usage as a percentage of quota; ≥70% → `status:"degraded"` (warn), ≥90% critical. Unmeasurable →
  `unknown` → degraded, never a false ok.

## Still needed for the warning to reach a person
Health now tells the truth, but nobody is notified unless something watches it. Cheapest path: a free uptime
monitor on `https://elostate.com/api/health` alerting on non-200 **and** on the keyword `degraded`. Turning on
Sentry (add `NEXT_PUBLIC_SENTRY_DSN`) makes the `[health]` console errors reach someone too.
