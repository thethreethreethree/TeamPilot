# 00 — Start Here

## What this is

A native Sales Coach app that is a **first-class client of the Elostate system you already run** — not a rebuild.
The backend, the accounts, and the coaching records already exist and are in daily use; this app plugs into them.

## What's already wired for you

- **`.env.local`** at the app root now holds the live Supabase URL + anon key + API base. You enter nothing.
- **`inject/`** holds real, working integration code (auth, session store, sync, AI client) ready to copy in.
- The **service-role key is intentionally NOT included** — see `02-AUTH-AND-CREDENTIALS.md § Keys` for why (short
  version: it bypasses all security and would leak from the app bundle; the app doesn't need it).

## The shortest path to "it works"

1. Open `inject/INSTALL.md`.
2. Run the one dependency-install line, copy the eight files, merge the auth gate into your root layout.
3. `npx expo start -c`, sign in with **your own Elostate email + password**.
4. You should land in the app, stay signed in across a restart, and see **your real sessions** (and only yours).

That is the core of the ask — existing users log in and their data syncs — reached with **zero backend change**.

## The mental model (one paragraph)

The app holds a **Supabase session** (the same kind the web app holds), stored encrypted on the device. For
**reading and syncing** a rep's own sessions/transcripts/outcomes, the app talks to Supabase **directly**, and
Row-Level Security guarantees it only ever sees that user's rows — no endpoint to build. For anything that **runs
server logic** — AI suggestions, transcription, KPI math — the app calls the coach **routes** with the session's
access token as a `Bearer`, so the server stays the single source of truth (no duplicated logic that could
drift). The AI routes accept that token today; the KPI/audio routes accept it after one small backend shim.

## Where to go next

- The full picture → `01-INTEGRATION-ARCHITECTURE.md`
- How login + keys work → `02-AUTH-AND-CREDENTIALS.md`
- What data the app reads and how → `03-DATA-MODEL-AND-SYNC.md`
- The phased plan → `07-BUILD-PLAN.md`
- How this respects your BUILD-STARTER V3 constitution → `08-RECONCILE-WITH-V3-BLUEPRINT.md`
