# 08 — Reconciling with BUILD-STARTER V3

Your `BUILD-STARTER V3 APP SYSTEM` blueprint is **on-device-first / single-user** by default: "On-device is the
default. A backend is an exception you justify, not a starting point" (`02-BACKEND-BLUEPRINT.md`). The Sales Coach
app *is* a backend app — so this doc justifies the exception explicitly and states which V3 rules adapt, so the
two systems don't silently contradict each other (§1.5 holistic).

## The exception is justified — by the blueprint's own test

V3 admits a backend when something is "100% essential and the device cannot do it alone: **multi-device sync,
server-authoritative shared state, or social / shared data between users**." The Sales Coach app hits **all
three**:
- **Multi-device sync** — a rep's sessions must appear on web and phone; the record is shared across devices.
- **Server-authoritative shared state** — company KPIs, manager cross-rep visibility, the append-only event
  chain: the *server* is the single source of truth, not any one device.
- **Shared data between users** — managers see their team's coaching; the data is inherently multi-user.

Crucially, the backend **already exists and is in production**. This app doesn't *introduce* a server "to feel
professional" (the exact anti-reason V3 names) — it connects to the system you already run. That is the strongest
possible justification.

## Which V3 rules adapt, and how

| V3 rule (default) | How it adapts for this server-backed app |
|---|---|
| **§1 Persistence — on-device is the source of truth** | Inverted: the **server** is the source of truth; the device holds a **cache + offline outbox**. On-device SQLite (Phase 4) is a replica, not the original. |
| **§2 Migrations on app launch** | Still applies — but to the **local cache schema** (replayable, `if not exists`, `user_version`), not to authoritative data. The authoritative schema is the Supabase migrations in TeamPilot. |
| **§7 Auth = local biometric gate** | Becomes **real login** (Supabase Auth) *plus* the local-secret rules unchanged: token in the Keychain via the encrypted store, fail-closed, one message for all failures, re-check authorization server-side. A biometric gate over the app is a good *addition* (Phase 5), not a replacement for login. |
| **§9 Data freshness** | Front-and-center: stale-while-revalidate, invalidate-on-write, and the offline outbox with conflict surfacing are *the* sync design (`03-DATA-MODEL-AND-SYNC.md`), because the truth is remote. |
| **§3 Money is integer** | **Adapted — the existing backend differs from the V3 default.** `deal_value` is `numeric(14,2)` (decimal dollars.cents) on the server, NOT integer minor units. The app must match the *backend's* representation (decimal, coerce PostgREST's possible string, never divide by 100) — not impose V3's integer-cents default on data it doesn't own. The V3 rule governs money the app originates locally; server-owned money follows the server. |
| **§4 Capacity in one transaction** | The relevant capacity (company-shared state) is **server-authoritative** — exactly V3's own carve-out ("a resource shared across users/devices cannot be arbitrated on a device"). The app proposes; the server decides. |
| **§6 Runaway guards** | Fully applies: debounce user-triggered AI calls, abort the SSE stream on screen-leave (stop metered spend), back off retries/polls. |
| **§10 Owner-configurable content** | Applies: anything that must change without a store build goes behind remote config, not the binary. |
| **§11 Media & permissions / §12 export** | Apply as written — narrowest mic permission at point of use, denial as a first-class path; export via the OS share sheet with CSV formula-injection neutralized. |

## The one rule that does NOT bend

**§7's spirit — fail closed, secrets never in plaintext, re-check authorization inside every privileged action —
holds completely.** A server-backed app has *more* attack surface, not less, so these get stricter: the session is
encrypted at rest, every data call is authorized server-side (RLS or Bearer validation), and the service-role key
never ships. The backend is not an excuse to relax the device rules; it's a reason to keep them.

## Net
This app is a **sanctioned V3 backend exception**, built to V3's own criteria, with the on-device rules preserved
wherever they still apply and the freshness/sync rules promoted to the center. Nothing here contradicts the
constitution; it applies the branch the constitution reserved for exactly this case.
