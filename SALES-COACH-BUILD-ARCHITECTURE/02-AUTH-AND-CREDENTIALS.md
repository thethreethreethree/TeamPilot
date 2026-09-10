# 02 — Auth & Credentials

## Existing users, existing credentials

The app uses **native Supabase Auth** against the same project the web app uses. An existing Elostate user signs
in with the **email + password they already have** (`supabase.auth.signInWithPassword` — `inject/src/lib/auth-context.tsx`).
There is **no sign-up** in the app: Sales Coach accounts are provisioned in the Elostate admin (an admin assigns
the sales-coach role), exactly as on the web (`src/app/sales-coach/login/page.tsx`). Nothing is re-created; the
same account, the same data.

## The session lives encrypted on the device

A Supabase session is an access-token JWT + a refresh token — several KB, more than the iOS Keychain's ~2 KB
per-item limit, and not something to leave in plaintext (your V3 §7). So the app uses the official pattern
(`inject/src/lib/secure-session-store.ts`):

1. Encrypt the session blob with a fresh random 256-bit key (AES-CTR, `aes-js`).
2. Store only that tiny **key** in `expo-secure-store` (Keychain / Keystore — fits the 2 KB limit).
3. Store the **encrypted blob** in AsyncStorage.

A thief with the AsyncStorage file can't decrypt it without the hardware-backed key. This satisfies "secrets in
the Keychain, never plaintext" precisely.

## Token refresh — handled by the library, not by hand

The browser extension had to hand-roll a **single-flight refresh** because Supabase rotates the refresh token and
has reuse-detection — two concurrent refreshes with the same token kill the whole session
(`extension-sales/background.js`, the "kicked out again and again" fix). The app does **not** repeat that work:
`supabase-js` owns single-flight refresh + rotation internally. We add only the standard `AppState` wiring
(`inject/src/lib/supabase.ts`) so the token keeps refreshing while the app is foregrounded and pauses when it's
backgrounded. On a 401 from a coach route, the client forces one `refreshSession()` and retries once
(`inject/src/lib/coach-api.ts`).

## Keys — what ships, what never ships

| Key | Ships in the app? | Why |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ yes (in `.env.local`) | Public project URL. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ yes (in `.env.local`) | **Public by design** — the anon key is meant to ship in clients; Row-Level Security is what protects data. |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **never** | It **bypasses all RLS**. Anyone can extract strings from an installed app bundle, so embedding it would hand every tenant's data — read and write — to anyone who downloads the app. This is a fact about how mobile apps and this key work, not a preference. |

**"But I don't want to re-enter codes."** You don't. The two public keys are already in the app's `.env.local`
(written for you, gitignored). Each *user's* authorization is their **own login token**, obtained once when they
sign in and then auto-refreshed — they never re-enter anything either. Refresh proxies through your server (which
holds the service key); the app never touches it. So the smooth, no-re-keying experience is fully delivered
**without** the one key that must not leave the server.

## Fail-closed behavior (V3 §7)

- No session → the auth gate shows sign-in, never a half-open app screen (`inject/src/app/_layout.auth-gate.example.tsx`).
- One message for every auth failure — the app never reveals whether an email exists (no enumeration oracle).
- A corrupt/undecryptable stored session is dropped and treated as signed-out, not crash-looped.
- Every privileged data call is authorized **server-side** (RLS or `admin.auth.getUser`), so a rendered screen is
  never the thing that grants access — the token is.
