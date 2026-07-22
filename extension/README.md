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

## Status (honest)
- **On-page panel** — minimizable, persistent, ✕/drag. Built; **browser-runtime untested** (checklist above). ✅ built / ⏳ verify
- **Reads selection + Summarize + Dissect** against live gated endpoints — server-side verified (200/401/402). ✅
- **Per-site adapters** (10 platforms) — routing + extraction unit-tested; **live selectors untested per platform**. ✅ built / ⏳ verify
- **One-click connect + silent refresh** — server-side verified; browser round-trip untested (checklist #6). ✅ built / ⏳ verify
- **Ask Coach / Co-pilot / Formulate / Spawn task** — endpoints not built (blocked on the **A3** control-window decision); shown **SOON**. ⏳
- **One-click OAuth** (`launchWebAuthFlow`) — now largely unnecessary (the connect handoff works); available later if wanted. ⏳
- Privacy policy: `/extension/privacy`. Icons reuse the square `elostate-logo.png`.

> Note: `popup.html` / `popup.js` remain in this folder but are **no longer referenced** by the manifest (the
> panel replaced them). Kept pending a keep-or-delete call; safe to remove.
