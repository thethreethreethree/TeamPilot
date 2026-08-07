# Sales Coach browser extension (standalone)

A **separate standalone** Chrome extension (MV3) — founder decision 2026-08-08 — sibling to the C.A.R.E
extension in [`../extension`](../extension). It puts sales coaching on the conversation the rep is already
viewing (Gmail, Outlook, Instagram, Messenger, WhatsApp Web, LinkedIn, Slack, …): read the room, coach the
draft, catch up on the deal, draft the next message.

## Status (honest)

| Piece | State | Verified? |
| --- | --- | --- |
| Server routes (`/api/coach/extension/{dissect,coach,summarize,copilot}`) | **Built** (Phase 1) | ✅ `npm run check`, per-route tests |
| `manifest.json` | Built | declarative |
| `config.js` (`SALES_TOOLS`) | Built + wired to the 4 routes | ✅ drift-guard test (below) |
| `background.js` (service worker) | **Not yet ported** | — |
| `content.js` (panel) | **Not yet ported** | — |
| `adapters.js` (per-site) | **Not yet ported** | — |
| `permission.html` / `permission.js` | **Not yet ported** | — |
| `icons/` | **Not yet added** | — |
| Auth: sales `connect` + `refresh` routes + `/extension/connect` handoff | **Not yet built** | — |

**This package is NOT yet loadable.** The manifest + config are the sales-specific, verifiable core; the
browser runtime and the auth handoff are the remaining port (Phase 2b), specced below. Nothing here claims to
be a working extension — the runtime cannot be exercised in the build sandbox (no browser), so those files
ship reasoned and **founder-live-verified per platform**, the same honesty posture as the existing 11 C.A.R.E
adapters.

## What is verified in-sandbox

`src/lib/coach/extension/__tests__/salesExtensionConfigWiring.test.ts` asserts, on every `npm run check`:
- every `SALES_TOOLS` endpoint maps to a real `route.ts` (no dead/soon tool shipped as a live button — A31);
- every endpoint is under `/api/coach/extension/` (not the C.A.R.E namespace);
- the token key (`salesCoachToken`), the injection guard (`__salesCoachConfigLoaded`), and the tools global
  (`SALES_TOOLS`) are all DISTINCT from the C.A.R.E extension, so both can be installed side by side.

## Phase 2b — the runtime port (well-scoped, mechanical)

Port from `../extension`, adapting C.A.R.E → Sales. The sales extension is **simpler**: it has the 4 text
tools only — NOT the RCD capture, media upload, or image-permission machinery (drop those handlers entirely).

1. **`background.js`** — keep: toolbar-click inject (`config.js, adapters.js, content.js`), the tool proxy
   (rename `care-tool` → `sales-tool`; `ALLOWED_ENDPOINT` → `/^\/api\/coach\/extension\/[a-z-]+$/`; forward
   only `conversation`, `draft`, `lastSpeaker`), the connect handoff (`onMessageExternal`, message type
   `sales-connect`, store `salesCoachToken`), and the badge. **Drop:** all `care-rcd-*` and `care-image-*`
   handlers. **Auth:** on 401 either (a) build a sales `refresh` route first, or (b) degrade to "Sign in"
   (clear token) — do NOT reference `/api/coach/extension/refresh` until it exists (the drift guard would not
   catch a missing refresh route, so this is a manual must).
2. **`content.js`** — the shadow-DOM panel. Render from `SALES_TOOLS`; the `coach` tool shows the draft
   textarea (its `input` field); `copilot`/`summarize`/`dissect` run on the scanned conversation alone. Send
   `sales-tool` to the worker. Render each tool's result shape: dissect `{dissect}`, coach `{coaching}`,
   summarize `{summary}`, copilot `{reply, reasoning}`.
3. **`adapters.js`** — per-site DOM readers. Copy the C.A.R.E adapters (same platforms, same reasoned-but-
   UNVERIFIED selectors) — they read the same DOM. Add the `lastSpeaker` read where the platform exposes it
   (drives copilot reply-vs-follow-up). Every selector stays labeled UNVERIFIED until confirmed live.
4. **Auth routes** — a sales `connect` page (`/extension/connect`) + token mint, mirroring the C.A.R.E
   handoff, so "Sign in" is one click. Until then the extension can't authenticate.
5. **`icons/`** — add 16/48/128 px icons.

Each of the above ships reasoned; the founder confirms it live in a real browser per platform.
