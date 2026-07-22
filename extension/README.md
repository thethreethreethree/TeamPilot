# C.A.R.E Browser Extension — dev (unpacked) build

A **Manifest V3** extension that runs the C.A.R.E tools on the text you have selected on any web page,
grounded in your own C.A.R.E account. This folder is the **no-build, load-unpacked developer version** — the
production build (Vite + CRXJS, React, shared components) is a later phase. See the full plan in
[docs/feature-specs/CARE-BROWSER-EXTENSION.md](../docs/feature-specs/CARE-BROWSER-EXTENSION.md).

## Install (Developer mode → unpacked)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select **this `extension/` folder**.
4. The C.A.R.E icon appears in the toolbar. Pin it.

## Use it
1. On any web page, **highlight** the conversation text you want help with.
2. Click the **C.A.R.E** toolbar icon → **Read my selected text**.
3. Pick a tool. **Summarize** is wired to the live backend; the others show "Coming" until their endpoints ship.

The selected text is sent to the backend to run the tool and is **not stored** (ephemeral).

## Connecting your account (dev)
Full one-click sign-in (`launchWebAuthFlow`) needs a Google OAuth client that isn't configured yet, so for
now use the **Developer connect**:
1. In the popup, expand **Developer connect (paste session token)**.
2. Paste a valid **Supabase access token** for your C.A.R.E account.
   - Quick way while signed into the app in the same browser: open DevTools on an app tab →
     Application → Local Storage → find the `sb-...-auth-token` value → copy the `access_token` field.
3. Click **Connect with token**.

Entitlement is enforced **server-side**: the tools work only for a **Pro/Enterprise** tenant or one within an
active **trial** (a 402 with an honest status is returned otherwise).

## Local backend
By default the extension calls `https://elostate.com`. To test against a local server, click **Settings** in
the popup and set the API base to e.g. `http://localhost:4321` (the `host_permissions` already allow it).

## Status (honest)
- **Loads unpacked, valid MV3 manifest, C.A.R.E aesthetic.** ✅
- **Reads the page selection + runs Summarize AND Dissect against the live gated endpoints.** ✅ (both verified end-to-end: 401/402/200.)
- **Ask Coach / Co-pilot / Formulate / Spawn task** — endpoints not built yet (blocked on the A3 control-window decision); shown as "Coming". ⏳
- **One-click OAuth sign-in** — scaffolded, needs a Google OAuth client ID; use Developer connect meanwhile. ⏳
- Privacy policy: `/extension/privacy` (host at `https://elostate.com/extension/privacy` for the store listing).
- Icons reuse the square `elostate-logo.png`; a dedicated extension icon can replace it before store submission.
