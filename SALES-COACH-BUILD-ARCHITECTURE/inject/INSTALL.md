# INSTALL — wiring the Sales Coach backend into the Expo app

This folder is a **drop-in build system**: real, working files you copy into the app, plus one optional backend
patch. It is grounded in the live Elostate backend (Supabase Auth + `/api/coach/**` routes), not generic
boilerplate. Follow the order — each step is verifiable before the next.

> Honesty note (§1.5.1 layer-2): this code is written against the real backend contract and the current
> Expo SDK 57 / supabase-js v2 APIs, but it has **not been run on a device in this session** (no simulator in the
> build environment). Treat "verified" as *you* running the checkpoints below, not my assertion.

---

## 0. Prerequisites (already true for your project)

- Expo SDK 57, expo-router with `src/app`, the `@/*` → `src/*` path alias (your `tsconfig.json`).
- `.env.local` at the app root — **already written for you** with the live Supabase URL + anon key + API base.
- A **development build** (you already have `expo-dev-client`). `expo-secure-store` + `react-native-get-random-values`
  are native modules; run in a dev build, not Expo Go, or the secure session store is absent at runtime.

## 1. Install the dependencies

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage expo-secure-store \
  react-native-get-random-values react-native-url-polyfill aes-js
npm i -D @types/aes-js
```

`expo/fetch` (used for SSE streaming) ships inside the `expo` package — nothing to install.

## 2. Copy the files

| From (this folder)                         | To (app)                                  |
|--------------------------------------------|-------------------------------------------|
| `src/lib/env.ts`                           | `src/lib/env.ts`                          |
| `src/lib/secure-session-store.ts`          | `src/lib/secure-session-store.ts`         |
| `src/lib/supabase.ts`                      | `src/lib/supabase.ts`                     |
| `src/lib/auth-context.tsx`                 | `src/lib/auth-context.tsx`                |
| `src/lib/coach-api.ts`                     | `src/lib/coach-api.ts`                    |
| `src/lib/sync/sessions.ts`                 | `src/lib/sync/sessions.ts`                |
| `src/types/backend.ts`                     | `src/types/backend.ts`                    |
| `src/app/(auth)/sign-in.tsx`               | `src/app/(auth)/sign-in.tsx`              |

> **Already installed — and the app has since moved on.** `src/` is now the
> source of truth, not this folder. Re-copying these over the app would be a
> regression. Two corrections were made after installation and are reflected in
> the copies here:
>
> - `sync/sessions.ts` imported `"../types/backend"`, which resolves to
>   `src/lib/types/backend` and does not exist. Corrected to `"@/types/backend"`.
> - `sign-in.tsx` was rebuilt onto the design tokens. Its original hardcoded
>   `#208AEF` was also off-brand: `docs/BRAND.md` §4.3 bans blue outright.
>
> The sign-in screen now also depends on `src/lib/tokens/` and `src/lib/theme.ts`
> (the token layer) and on NativeWind, none of which existed when this table was
> written.
>
> One correction to the docs themselves: `03-DATA-MODEL-AND-SYNC.md` and
> `01-INTEGRATION-ARCHITECTURE.md` describe `deal_value` as "integer minor
> units". It is `numeric(14, 2)` — an exact decimal in MAJOR units — per
> `supabase/migrations/0205_kpi_foundation.sql`, and PostgREST serialises it as a
> string. `src/types/backend.ts` has this right. Treating it as minor units
> renders $1,500.00 as $15.00.

## 3. Wire the auth gate into your root layout

`src/app/_layout.auth-gate.example.tsx` is a **reference**, not a drop-in — merge its pattern into your real
`src/app/_layout.tsx`: wrap the tree in `<AuthProvider>` and redirect on `status` (signed-out → `(auth)/sign-in`,
signed-in → your first app screen). Keep your existing fonts/theme/splash handling.

## 4. Checkpoint — Phase 1 works with ZERO backend change

1. `npx expo start -c` (clear cache so the new env vars load), open the dev build.
2. Sign in with **your existing Elostate email + password**. You should land in the app.
3. Kill and reopen the app — you should **stay signed in** (encrypted session restored from the Keychain).
4. Call `listMySessions()` (from `src/lib/sync/sessions.ts`) on a screen — you should see **your real sessions**,
   and only yours (RLS). Call `suggestOnce({ conversation: "..." })` — you should get a real AI reply.

If all four pass, existing users can log in and their data syncs — the core of the ask — with no backend change.

## 5. (Phase 2, optional) The Bearer shim — unlock KPIs + audio through the same routes

The KPI and audio routes authenticate by **web cookie** today, so a mobile Bearer token won't reach them yet.
When you want KPIs and audio upload in the app, apply the backend patch in `backend-patch/resolveApiAuth.ts` to the
**TeamPilot** repo (see `../06-BACKEND-BEARER-SHIM.md`). The app's `coach-api.ts` already sends the Bearer, so
those endpoints light up the moment the shim deploys — no app change.

See `../07-BUILD-PLAN.md` for the full phased plan and `../08-RECONCILE-WITH-V3-BLUEPRINT.md` for how this fits
your on-device-first BUILD-STARTER V3 constitution.
