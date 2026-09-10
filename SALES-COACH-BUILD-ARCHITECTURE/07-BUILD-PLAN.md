# 07 — Build Plan

Phased, each phase **shippable and verifiable end-to-end** before the next (V3 §1.5.1 layer-2: "does it actually
work," proven, not "the code compiles"). The order is deliberate: the smoothest, zero-backend-change value first.

---

## Phase 0 — Foundation (½ day)
**Goal:** the integration layer compiles and the app boots.
- Install deps + copy `inject/` files (`inject/INSTALL.md` steps 1–2).
- Merge the auth gate into `src/app/_layout.tsx`.
- **Verify:** `npx expo start -c` boots to the sign-in screen with no red box.

## Phase 1 — Login + session sync (1–2 days) · ZERO backend change
**Goal:** existing users log in and see their real data. *This is the core of the ask.*
- Sign-in screen wired to `useAuth().signIn` (already built).
- A "My Sessions" list from `listMySessions()`; a session detail screen from `getSession` + `getTranscript` +
  `getCues`.
- Stale-while-revalidate + `subscribeMySessions()` for realtime.
- **Verify (the four checkpoints in INSTALL §4):** sign in with a real account; stay signed in across restart;
  see your sessions and *only* yours; a second device's new session appears live.
- **Layer-2 gate:** a real rep signs in on a real build and recognizes their own calls. Not "the query returns."

## Phase 2 — Live AI coaching (2–3 days) · ZERO backend change
**Goal:** the coach's "Suggested Response" + "Prospect Intel" in the app.
- A coaching screen calling `streamSuggest()` (SSE, token-streamed) with an AbortController tied to screen-leave
  (stop billing the LLM when the user backs out — the extension learned this the expensive way).
- `suggestOnce()` as the non-stream fallback; `dissect` via `coachPost`.
- **Verify:** type/paste a conversation, watch the reply stream in; leave mid-stream and confirm generation stops.

## Phase 3 — KPIs + audio (3–5 days) · needs the Phase-2 Bearer shim
**Goal:** the KPI board and call recording, reusing server logic.
- Apply `06-BACKEND-BEARER-SHIM.md` to TeamPilot (kpi + audio routes). *(TeamPilot change → its own TBC ceremony.)*
- KPI board from `/api/coach/kpi/me?scope=self|company` — **fetched, never recomputed on-device** (§2.2).
- Audio: record (`expo-av`/`expo-audio`) → `…/upload-recording/sign` → direct-to-Storage upload → `…/upload-recording`
  → diarized transcription + the "which voice is you?" tap. Cap size; sniff magic bytes; name the real limit on error.
- **Verify:** the app's KPI numbers match the web's for the same rep to the digit (same source). A recorded call
  transcribes and attaches.

## Phase 4 — Offline & durability (3–5 days)
**Goal:** the app survives a bad network.
- `expo-sqlite` cache of the rep's sessions; a durable, ordered **offline outbox** for writes that replays on
  reconnect and reconciles against the server (surface conflicts, never silently drop — V3 §9).
- Mirror the backend's audio-durability chunking (`…/[id]/audio-chunk?seq=N`) so a dropped call isn't lost.
- **Verify:** airplane-mode a capture, reconnect, confirm it lands exactly once (race it — two replays must not
  double-write; the backend has an append-only double-write class, so key the outbox idempotently).

## Phase 5 — Surface & App Store (ongoing)
**Goal:** the design the app deserves + shippable to the stores.
- Real design pass (this is layer-4 *and*, where you specify the experience, layer-2 — don't ship it monochrome
  if you asked for color; your AMD-012 rule).
- Permission usage strings (mic), narrowest-permission-at-use, denial as a first-class path.
- EAS build/submit (your `eas.json` already has dev/preview/production profiles); `com.elostate.salescoach`.
- Name the standing dependency: anything that can only change by shipping a store build belongs behind remote
  config, not the binary (V3 §10).

---

## Dependency map
```
Phase 0 ─▶ Phase 1 ─▶ Phase 2 ─▶ Phase 3 ─▶ Phase 4 ─▶ Phase 5
                 │                    ▲
                 └── (nothing) ───────┘  Phase 3 also needs the TeamPilot Bearer shim deployed
```

## What "done" means per phase
Not "the code runs on my machine." Done = the phase's **Verify** line passes on a real dev build with a real
account — completion is your confirmation, not the absence of a compile error (verification discipline).

## Honest status of this build system
The `inject/` code is written against the real backend contract and current Expo SDK 57 / supabase-js v2 APIs,
but has **not been executed on a device in this session** (no simulator here). Phase 0's boot check is the first
real proof; treat everything until then as "should work," and let the checkpoints — not my word — confirm it.
