# Operator config checklist — env vars that activate built features

Several features are **built and verified correct in code** but silently inert until their env vars are set in
Vercel. This is the complete config surface (from a `grep process.env` sweep 2026-07-23). "Verified" = I traced
the code path this session; "inferred" = from the var name + where it's read (confirm before relying on it).

## CORE — the app doesn't work without these
| Var | Enables | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Auth + DB | verified — `auth-helpers`, middleware. Without it, demo mode (auth skipped). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth + DB | verified. |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin ops, crons, service-role reads | verified — crons + admin routes. |

## AI — at least ONE LLM provider is required for any AI feature
| Var | Enables | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`) | Anthropic provider | verified — `llm/anthropic.ts`. |
| `DEEPSEEK_API_KEY` (+ `DEEPSEEK_MODEL`) | DeepSeek provider | verified. **⚠️ If set, DeepSeek is PRIMARY (China-based) for ALL AI incl. customer extension data — see the data-governance flag in FOUNDER-ACTION-QUEUE.** |
| `LLM_PROVIDER` | Explicit provider pin (`anthropic`\|`deepseek`) | verified — `chooseProvider`. Set to `anthropic` to force it. |

## BACKGROUND JOBS — one secret enables all four crons
| Var | Enables | Notes |
|---|---|---|
| `CRON_SECRET` | **All 4 Vercel crons**: durability-sweep (hourly), task-overrun, backfill-dissects, finance-reports | verified — every cron route rejects until set. **The durability sweep IS the §3.5 moat metric** — without this the "did the resolution HOLD or REOPEN" measurement never runs. |
| `CARE_DURABILITY_SWEEP_SECRET` | The POST (non-cron) durability trigger | inferred — the manual-trigger variant of the same sweep. |
| `TASK_OVERRUN_SWEEP_SECRET` | The POST (non-cron) task-overrun trigger | inferred — same pattern. |

## PUSH NOTIFICATIONS — 3 vars (generate with `npx web-push generate-vapid-keys`)
| Var | Enables | Notes |
|---|---|---|
| `VAPID_SUBJECT` | Web Push | verified — `sender.ts`. mailto:/https URL. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push | verified. |
| `VAPID_PRIVATE_KEY` | Web Push | verified. Without all 3, subscriptions never receive pushes (sender logs which are missing). |

## CARE INBOUND EMAIL — the email support channel
| Var | Enables | Notes |
|---|---|---|
| `CARE_INBOUND_EMAIL_SECRET` | Inbound-email webhook auth | verified — the inbound route rejects without it (constant-time). |
| `POSTMARK_SERVER_TOKEN` | Email send/receive via Postmark | inferred — confirm the send path. |
| `CARE_EMAIL_HOST_DOMAIN` | Per-tenant inbound email addressing | inferred. |

## VOICE (Sales Coach real-time cue) — optional
| Var | Enables | Notes |
|---|---|---|
| `ELEVENLABS_API_KEY` (+ `ELEVENLABS_DEFAULT_VOICE_ID`) | Voice synthesis for the coach | inferred — confirm the voice path. Optional feature. |

## OTHER
| Var | Enables | Notes |
|---|---|---|
| `CARE_DEFAULT_TENANT_ID` | Overrides the vendor/home company (else `ELOSTATE_COMPANY_ID`) | verified — `vendorAuth`, `care/config`. Keeps vendor-admin + "our own company" consistent. |
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs (emails, links) | inferred. |
| `NEXT_PUBLIC_CARE_EXTENSION_ID` | Pins the extension token hand-off (`/extension/connect`) to the OFFICIAL extension id | verified 2026-07-23. **SECURITY:** set to the Web Store extension id in production. Until set, the connect page hands the session+refresh token to whatever `?ext=` id is in the URL (token-theft vector — see the extension audit doc's connect-page finding). Unset is only acceptable for unpacked local dev. |
| `EXECOS_ALLOW_SEED` / `EXECOS_INTEGRATION_TEST` | Dev/test flags | verified — gate seed + the live-DB integration tests. Leave unset in prod. |

## Fastest activation for launch
1. Core (Supabase ×3) — presumably already set (the app runs).
2. One LLM provider — decide DeepSeek-primary vs Anthropic (**data-governance flag**).
3. `CRON_SECRET` — turns on the §3.5 measurement + 3 crons. **High value, one var.**
4. VAPID ×3 — push notifications.
5. Email + Voice — only if you want those channels.
