# Sales Coach — Native App Build Architecture

A drop-in **build plan + build system** for the native (Expo / React Native) Sales Coach app, wired to reuse the
**existing Elostate backend**: same Supabase project, same accounts, same records. Existing users sign in with the
credentials they already have, and their sessions + data sync — no separate backend, no re-created accounts.

> Grounded, not generic. Every file here is written against the real backend as it exists today
> (`c:\Users\johns\OneDrive\Documents\GitHub\TeamPilot`): the Supabase Auth flow, the `coaching_sessions` data
> model + RLS, the `/api/coach/**` routes, the audio storage path, and the browser extension's proven auth
> pattern. Sources are cited by file path throughout.

---

## The two decisions you made, and how they're honored

1. **Sign-in → Native Supabase Auth (direct).** The app talks to your Supabase project directly with the public
   anon key. Users type their existing Elostate email + password *inside the app*; the session is stored
   encrypted on-device and auto-refreshes. No web bounce, no re-keying. → `02-AUTH-AND-CREDENTIALS.md`.

2. **Data path → "the smoothest, no re-entering."** Sequenced so the smooth part ships **with zero backend
   change**: login + full session/transcript/outcome sync ride your existing Row-Level Security, and the AI
   routes already accept a mobile token. KPIs + audio come in a later phase via one small, low-risk backend shim
   that lets those routes reuse your server logic instead of duplicating it. → `07-BUILD-PLAN.md`.

**Keys.** The two keys the app legitimately needs (Supabase URL + anon key, both public-by-design) are already
written into the app's gitignored `.env.local`. The `SUPABASE_SERVICE_ROLE_KEY` is deliberately **not** shipped —
it bypasses all security and anyone can extract keys from an installed app; the app never needs it. →
`02-AUTH-AND-CREDENTIALS.md § Keys`.

---

## What's here

| Path | What it is |
|---|---|
| `00-START-HERE.md` | The 5-minute orientation: what's already wired, the first run. |
| `01-INTEGRATION-ARCHITECTURE.md` | The whole reuse architecture — how the app, Supabase, and the coach routes fit. |
| `02-AUTH-AND-CREDENTIALS.md` | Native Supabase Auth, the encrypted session store, token refresh, the keys policy. |
| `03-DATA-MODEL-AND-SYNC.md` | The real tables + columns + RLS, and the direct-Supabase sync path. |
| `06-BACKEND-BEARER-SHIM.md` | The optional Phase-2 backend patch (one helper) that unlocks KPIs + audio. |
| `07-BUILD-PLAN.md` | The phased, shippable build sequence (each slice verifiable end-to-end). |
| `08-RECONCILE-WITH-V3-BLUEPRINT.md` | Why this server-backed app is a *justified* exception to your on-device-first V3, and which V3 rules adapt. |
| `inject/` | The actual drop-in code + config. Start at `inject/INSTALL.md`. |

## Start

Read `00-START-HERE.md`, then `inject/INSTALL.md`.
