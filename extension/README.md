# C.A.R.E Browser Extension — dev (unpacked) build

A **Manifest V3** extension that runs the C.A.R.E tools on the conversation you're viewing on any web page,
grounded in your own C.A.R.E account. This folder is the **no-build, load-unpacked developer version** — the
production build (Vite + CRXJS, React, shared components) is a later phase. Full plan:
[docs/feature-specs/CARE-BROWSER-EXTENSION.md](../docs/feature-specs/CARE-BROWSER-EXTENSION.md).

## Install (Developer mode → unpacked)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select **this `extension/` folder**.
4. The C.A.R.E icon appears in the toolbar. Pin it.

> After pulling new changes, click the **↻ reload** button on the extension's card at `chrome://extensions`.

## How it works (on-page panel, not a popup)
Clicking the toolbar icon **injects an on-page panel** into the current tab (it does **not** open a popup — a
popup auto-closes the moment you click the page, which is fatal when you need to select text on that page). The
panel:
- **stays open** until you close it, **minimizes** to a floating bubble (the `–` button), has an **✕** close,
  and can be **dragged** by its header.
- Clicking the icon again **toggles** the panel show/hidden. ✕ fully removes it; the icon re-injects it.

## Use it
- **On a known platform** (Gmail, Outlook, Instagram, Messenger/Facebook, WhatsApp Web, LinkedIn, Gorgias,
  Zendesk, Intercom, Front): click **Read this thread** to auto-read the open conversation.
- **Anywhere else** (or if auto-read finds nothing): **highlight** the conversation, then **Read my selected
  text**.
- Then pick a tool. **Summarize** and **Dissect** are live; the other four show **SOON** until their endpoints
  ship.

The text is sent to the backend to run the tool and is **not stored** (ephemeral, §3.4).

## Connecting your account (one click)
1. In the panel, click **Sign in**. It opens `/extension/connect?ext=<id>` in a new tab.
2. If you're logged into the app there, the page **hands your session straight back to the extension** — the
   panel flips to **Connected**. No token paste.
3. The extension **silently refreshes** the session when it expires — no hourly reconnect.

Entitlement is enforced **server-side**: the tools work only for a **Pro/Enterprise** tenant or one within an
active **trial** (otherwise a 402 with an honest status).

## Local backend
By default the extension calls `https://elostate.com`. To test a local server, set `apiBase` in the extension's
storage to e.g. `http://localhost:4321` (the `host_permissions` already allow it).

---

## Load-and-test checklist (browser-runtime — needs a human; can't be verified headlessly)
Everything server-side is verified (endpoints return 200 for a trial account; refresh 200/401; adapter routing
+ extraction have 16 passing unit tests). These **in-browser** behaviors still need one manual pass:

| # | Do this | Expect |
|---|---------|--------|
| 1 | Click the C.A.R.E toolbar icon on a normal page (e.g. a news site) | Panel appears top-right |
| 2 | Click the icon again | Panel hides; click again → shows |
| 3 | Click **–** | Panel collapses to a small yellow bubble; click bubble → restores |
| 4 | Click **✕** | Panel disappears; icon re-opens it |
| 5 | Drag the header | Panel moves and stays put |
| 6 | Click **Sign in** (when disconnected) → sign into the app in the opened tab | Return to the panel: it shows **Connected** (green dot) |
| 7 | On a page, highlight text → **Read my selected text** | "Read N characters. Pick a tool." |
| 8 | Click **Summarize** | Real summary renders |
| 9 | Click **Dissect** | PROBLEM / ROOT CAUSE / OUTSIDE VIEW / GUIDING QUESTION render |
| 10 | Open Gmail, open an email thread → **Read this email thread** | Reads the thread without highlighting |

If #10 (or any adapter) reads nothing, it falls back to manual selection by design — tell me which platform and
I'll tighten that adapter's selectors (they're reasoned but not yet browser-confirmed).

### Troubleshooting (symptom → why → what to do)
Grounded in the actual architecture, so you can self-diagnose before pinging me.

| Symptom | Likely cause | Do |
|---|---|---|
| Icon does nothing on `chrome://…`, the Web Store, or a PDF | Chrome forbids content-script injection on those pages (by design) | Try a normal `https://` site (Gmail, a news site) |
| Panel opens but **every tool** errors "Couldn't reach C.A.R.E" | The background service worker isn't reaching the API | `chrome://extensions` → C.A.R.E → **service worker** → Console; look for the failed request. Confirm you're Connected (green dot). |
| Tools return **"session expired / Sign in"** repeatedly | Refresh token missing or rejected | Click **Sign in** again to re-hand-off; the worker should then silently refresh. If it recurs, the refresh token didn't store — reconnect. |
| **402 "plan doesn't include the extension"** | Tenant isn't pro/enterprise and has no active trial | Start a trial or set plan to pro (server-enforced — this is correct, not a bug) |
| **Sign in** opens the tab but panel stays "Not connected" | The connect page couldn't message the extension (externally_connectable) | Make sure you land on `elostate.com` (not localhost) and are logged in; the tab should say "Connected". Reload the extension if you just changed its code (the id changes). |
| An **adapter** ("Read this thread") reads nothing | That platform's DOM selectors didn't match (they're unverified per-platform) | Use **Read my selected text** instead (always works); tell me the platform so I tighten it |
| **"Read my selected text"** says nothing selected | Selection was empty when clicked | Highlight first, then click. (Clicking the button no longer collapses the selection — fixed — so a real highlight will register.) |
| Panel styling looks broken / off | It shouldn't — it's in a closed Shadow DOM, isolated from page CSS | If it happens, screenshot it; that's a real bug to report |
| After editing `extension/` code, changes don't show | The unpacked extension is cached | `chrome://extensions` → click **↻ reload** on the C.A.R.E card, then re-open the panel |

## Status (honest)
- **On-page panel** — minimizable, persistent, ✕/drag. Built; **browser-runtime untested** (checklist above). ✅ built / ⏳ verify
- **Reads selection + Summarize + Dissect** against live gated endpoints — server-side verified (200/401/402). ✅
- **Per-site adapters** (10 platforms) — routing + extraction unit-tested; **live selectors untested per platform**. ✅ built / ⏳ verify
- **One-click connect + silent refresh** — server-side verified; browser round-trip untested (checklist #6). ✅ built / ⏳ verify
- **Ask Coach / Co-pilot / Formulate / Spawn task** — endpoints not built (blocked on the **A3** control-window decision); shown **SOON**. ⏳
- **One-click OAuth** (`launchWebAuthFlow`) — now largely unnecessary (the connect handoff works); available later if wanted. ⏳
- Privacy policy: `/extension/privacy`. Icons are true per-size PNGs (16/48/128 px), LANCZOS-downscaled from the
  square logo master (2026-07-22 — they were previously all 1024² copies renamed, which rendered soft in the toolbar).

> Note: the old `popup.html` / `popup.js` were **deleted** (2026-07-22) once the on-page panel replaced them —
> they were dead code (unreferenced by the manifest) and a divergent copy of the panel's logic. The extension is
> panel-only now. (Recoverable via git history if a popup surface is ever wanted.)
