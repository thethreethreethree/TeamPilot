# 01 — Integration Architecture

How the native app reuses the existing Elostate backend. Everything below is grounded in the real repo
(`TeamPilot`); file paths are cited so you can verify each claim.

---

## The shape

```
┌───────────────────────────────┐
│  Native app (Expo / RN 0.86)  │
│                               │
│  Supabase session (encrypted  │        ┌──────────────────────────────┐
│  on device — Keychain-backed) │        │        Supabase project       │
│                               │        │   (your Supabase project)     │
│  ┌─────────────────────────┐  │  RLS   │                              │
│  │ direct reads / sync     │──┼───────▶│  Postgres: coaching_sessions │
│  │ (supabase-js, anon key) │  │  (user │  transcript_segments, cues,  │
│  └─────────────────────────┘  │  JWT)  │  outcomes, after_pitch, …    │
│                               │        │  Storage: assets-v1 (audio)  │
│  ┌─────────────────────────┐  │        │  Auth: email/password        │
│  │ coach API client        │  │        └──────────────────────────────┘
│  │ (Bearer access token)   │  │                    ▲
│  └───────────┬─────────────┘  │                    │ service-role
└──────────────┼────────────────┘                    │ (server only)
               │  Authorization: Bearer <jwt>        │
               ▼                                     │
      ┌────────────────────────────────────────────────────────┐
      │  Next.js backend  https://elostate.com  (TeamPilot)     │
      │                                                        │
      │  /api/coach/extension/**   ← accepts Bearer TODAY      │
      │     suggest (SSE), dissect, refresh                    │
      │  /api/coach/sales-session/**, /api/coach/kpi/**        │
      │     ← web-cookie today; +Bearer after the Phase-2 shim │
      │     (AI generation, transcription, KPI compute,        │
      │      event-sourcing — the single source of truth)      │
      └────────────────────────────────────────────────────────┘
```

## Two channels, deliberately

| Channel | Used for | Auth | Backend change? |
|---|---|---|---|
| **Direct Supabase** (`supabase-js` + anon key + user session) | Reading/syncing a rep's own sessions, transcripts, cues, outcomes; realtime; offline cache | Row-Level Security on the user's JWT | **None** — RLS already scopes to owner/manager |
| **Coach API client** (`Bearer <access token>`) | Anything that *runs server logic*: AI suggestions, audio transcription, KPI computation, event emission | `admin.auth.getUser(token)` server-side | AI routes: **none**. KPI/audio: one shim (Phase 2) |

**Why split this way** — the split is not arbitrary; it follows the §2.2 rule *consume the verdict, don't
re-derive it*. Reads are just data, so the client reads them directly (fast, realtime, offline). But the KPI
formula, the AI prompts, and the event chain are **decisions the server owns**; re-implementing them on the
device would create a second copy that drifts from the real one. So those stay server-side and the app calls
them. The app is a **thin client of your existing logic**, not a fork of it.

## What each backend piece is (grounded)

- **Auth** — Supabase Auth, email/password (`supabase.auth.signInWithPassword`), the same accounts across every
  Elostate module. Web login: `src/app/sales-coach/login/page.tsx`. The app mirrors its "sign-in only" rule.
- **Session model** — `coaching_sessions` (owned by `agent_id`, scoped to `company_id`) + append-only
  `coaching_transcript_segments`, `coaching_cues`, `coaching_cue_outcomes`, `after_pitch_summaries`. Foundation:
  `supabase/migrations/0070_live_sales_coach_foundation.sql`. Full column list in `03-DATA-MODEL-AND-SYNC.md`.
- **RLS** — every coaching table has row-level security; a signed-in user reads their own rows (a manager reads
  the company's). Policies: migrations `0082`/`0084` (+ `0080` for outcomes/summaries). This is what makes the
  direct-read channel safe with no endpoint.
- **AI routes (Bearer today)** — `POST /api/coach/extension/suggest` (streams `event: delta/done/error`; also a
  non-stream `{reply, reasoning}`), `POST /api/coach/extension/dissect`, `POST /api/coach/extension/refresh`.
  Server gate: `src/lib/api/extensionAuth.ts` + `extensionGuard.ts`. The app's `inject/src/lib/coach-api.ts`
  speaks exactly this.
- **Audio** — private `assets-v1` bucket, path `{companyId}/{YYYY}/{MM}/{fileId}.ext`
  (`src/lib/storage/assets.ts`). Large recordings bypass the ~4.5 MB serverless body cap via a **signed
  direct-to-Storage upload**: `POST …/[id]/upload-recording/sign` → upload bytes straight to Storage → `POST
  …/[id]/upload-recording` with the path → server runs diarized transcription. The app replicates this in Phase 3.
- **The browser extension** — the existing non-web client, and the template this app follows: it authenticates
  with a stored Supabase Bearer token and consumes the same SSE stream (`extension-sales/background.js`). The app
  improves on it: because an Expo app *is* a real Supabase client, it uses native Supabase Auth (with library-owned
  refresh) instead of the extension's web token hand-off + hand-rolled refresh.

## What the app must NOT do (guardrails carried from the backend)

- **Never embed the service-role key.** Server-only. → `02 § Keys`.
- **Never re-implement the KPI math on-device.** Reuse `/api/coach/kpi/me` via the shim. Drift is a §2.2 defect.
- **Handle `deal_value` as `numeric(14,2)` decimal currency** (dollars.cents, e.g. `1500.00`) — NOT integer cents. It may arrive as a string from PostgREST; coerce with `Number()` and never divide by 100. (Note: this backend stores money as decimal numeric, which differs from your V3 §3 "integer minor units" default — match the backend, not the default.)
- **Transcript/cue/outcome tables are append-only** — insert, never update/delete (the server enforces it; the
  app should not assume it can edit history).
