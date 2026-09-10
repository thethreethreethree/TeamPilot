# CONTINUE HERE — Sales Coach app, hand-off state

> ## Shipping, not building? Start with these three.
>
> The app is feature-complete against both build specs. What remains is getting it
> onto a phone and into the App Store, and those files are the ones you want:
>
> | File | What it is for |
> |---|---|
> | **`DEVICE-CHECK.md`** | 26 checks to run on a real phone. If you have five minutes, do check 1. |
> | **`APP-STORE-SUBMISSION.md`** | The App Review notes, the App Privacy answers, and what a reviewer will ask. |
> | **`APP-STORE-LISTING.md`** | Name, subtitle, description, keywords, category — written and ready to paste. |
>
> `PHASE-3-SHIM-TO-APPLY.md` is **superseded** — its change is merged and live. It
> is kept for the history only.
>
> Everything below is the original hand-off, and still accurate about how the app
> is put together.

Status as of the architecture build. Read this first if you're continuing the app in this project.

## ✅ Done (complete + grounded in the live Elostate backend)

- **Full architecture + build plan** → `SALES-COACH-BUILD-ARCHITECTURE/` (8 docs). Start at its `README.md` →
  `00-START-HERE.md`.
- **The decisions:** native Supabase Auth (existing users sign in with current email/password); data path
  sequenced so login + sync ship with **zero backend change**, KPIs/audio via a small Phase-2 backend shim.
- **Keys wired:** `.env.local` at this app root holds the live `EXPO_PUBLIC_SUPABASE_URL` + anon key + API base
  (gitignored). Service-role key deliberately excluded (never ships in a client). You enter nothing.

## ✅ Already wired into THIS app (not just the docs)

- **Dependencies installed** (`npx expo install` ran, exit 0): `@supabase/supabase-js`,
  `@react-native-async-storage/async-storage`, `expo-secure-store`, `react-native-get-random-values`,
  `react-native-url-polyfill`, `aes-js` (+ `@types/aes-js`).
- **Integration code copied into `src/`:**
  - `src/lib/env.ts`, `src/lib/secure-session-store.ts`, `src/lib/supabase.ts`, `src/lib/auth-context.tsx`,
    `src/lib/coach-api.ts`, `src/lib/sync/sessions.ts`, `src/types/backend.ts`
  - `src/app/(auth)/sign-in.tsx` (the sign-in screen)

## ⏳ Not done yet (your next steps — see `SALES-COACH-BUILD-ARCHITECTURE/07-BUILD-PLAN.md`)

1. **Merge the auth gate into `src/app/_layout.tsx`.** Reference: `SALES-COACH-BUILD-ARCHITECTURE/inject/src/app/_layout.auth-gate.example.tsx`.
   ⚠️ **SDK-57 router caveat (per AGENTS.md — verify against the SDK 57 docs before writing router code):** this
   template uses `expo-router/unstable-native-tabs` (`src/components/app-tabs.tsx`) rendered directly as the root
   navigator. To gate auth you need a **root Stack/Slot with the tabs nested in an `(app)` group** (move
   `src/app/index.tsx` + `explore.tsx` into `(app)/`), because with NativeTabs at the root every route becomes a
   tab and a non-tab route (sign-in, a session-detail push) can't sit beside it. Confirm the exact SDK-57 pattern
   (`Stack.Protected` guard vs. the redirect-in-effect gate) before restructuring — don't guess the API.
2. **Phase-1 screens:** a "My Sessions" list (`listMySessions()`), a session detail (`getSession` +
   `getTranscript` + `getCues`), realtime via `subscribeMySessions()`. All read helpers are ready in
   `src/lib/sync/sessions.ts`.
3. **Phase-2 coaching screen:** `streamSuggest()` from `src/lib/coach-api.ts` (SSE, abort on screen-leave).
4. **Phase-3 (needs the backend shim):** apply `SALES-COACH-BUILD-ARCHITECTURE/inject/backend-patch/resolveApiAuth.ts`
   to the TeamPilot repo, then the KPI board (`/api/coach/kpi/me`) + audio record/upload light up.


## Do not rename `expo.name` (learned the expensive way, 2026-09-03)

`expo.name` is not just a label — Expo derives the **Xcode target name** from it
(`sanitizedName`), and EAS registers the provisioning profile against that target.
Changing it breaks the build at the *Configure Xcode project* phase with an empty
error message, which the CLI reports only as `Unknown error`:

```
Could not find target 'ElostateSalescoach' in project.pbxproj
```

`"Elostate-Sales-coach"` → target `ElostateSalescoach` (what the credentials expect).
`"Sales Coach"`          → target `SalesCoach`         (build fails).

To change the name shown under the icon on the home screen, set
`ios.infoPlist.CFBundleDisplayName` instead. It is a plain Info.plist string and
does not touch the Xcode project. That is what this repo now does.

## Verify (the real proof — I have no simulator; this is your checkpoint)

`npx expo start -c` → sign in with your own Elostate account → you should land in the app, stay signed in across a
restart, and see **your real sessions and only yours** (RLS). That's Phase 1 done. Details:
`SALES-COACH-BUILD-ARCHITECTURE/inject/INSTALL.md` §4.

## Verified + corrected (post-build pass against the real backend)

Three defects in the first cut were caught by checking the code against the live TeamPilot backend and fixed:
1. **`resolveApiAuth.ts`** had an unused `createClient` import (would trip lint) — removed.
2. **`deal_value` is `numeric(14,2)` decimal currency** (e.g. `1500.00`), **NOT integer cents** — I'd wrongly
   applied the V3 "money is integer" rule. Fixed in `types/backend.ts` + the 01/03/08 docs. **Do not divide by
   100**; coerce PostgREST's possible string with `Number()`.
3. **Realtime is very likely OFF** — no migration adds `coaching_sessions` to the `supabase_realtime`
   publication, so `subscribeMySessions()` connects but never fires. Use **polling (stale-while-revalidate) as the
   baseline**; enable the publication if you want live push. Flagged in `sync/sessions.ts` + the 03 doc.

Still-unverified (needs your device / a live check): everything runtime — the on-device build, sign-in, the SSE
stream, and the audio flow. The Verify checkpoints below are the real proof.

## Design note (AMD-012)
When you specify the app's look/feel as a requirement, that's part of the result — not deferrable polish. The
current screens are intentionally plain scaffolding; the design pass is Phase 5.
