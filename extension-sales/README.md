# Sales Coach browser extension (standalone)

A **separate standalone** Chrome extension (MV3) — founder decision 2026-08-08 — sibling to the C.A.R.E
extension in [`../extension`](../extension). It puts sales coaching on the conversation the rep is already
viewing (Gmail, Outlook, Instagram, Messenger, WhatsApp Web, LinkedIn, Slack, …): read the room, coach the
draft, catch up on the deal, draft the next message, or shape what the rep wants to say.

## Status (honest) — complete and shipping

| Piece | State |
| --- | --- |
| Server routes (`/api/coach/extension/{dissect,coach,summarize,copilot,formulate}`) | **Built + tested** |
| Auth: `refresh` route (`/api/coach/extension/refresh`, shared `refreshExtensionSession`) | **Built + tested** |
| `manifest.json` | **Built** — least-privilege (activeTab/scripting/storage + host `elostate.com` only), gated |
| `config.js` (`SALES_TOOLS`) | **Built + wired** — drift-guard test |
| `background.js` (service worker) | **Built** — inject-on-click, tool proxy, 401→refresh→retry, connect handoff |
| `content.js` (panel) | **Built** — shadow-DOM panel, 5 tools, Copy, sign-in/401 states, empty-input guard |
| `adapters.js` (per-site) | **Built** — 13 platforms (7 Tier-1 reused + 6 Tier-2); routing + extraction tested |
| Connect handoff (product-aware `/extension/connect?product=sales`) | **Built** |
| Download page + zip (`/extension/download-sales`, `public/sales-coach-extension.zip`) | **Built + served live** |
| `icons/` | ELOSTATE brand placeholder (a distinct Sales Coach mark is a founder decision) |

**This package is complete, loadable, CI-green, and deployed** — it's downloadable at
`/extension/download-sales` and installable per [`../docs/SALES-COACH-EXTENSION-TESTING.md`](../docs/SALES-COACH-EXTENSION-TESTING.md).
The RCD capture / media upload / image-permission machinery from C.A.R.E is **intentionally dropped** (sales is
text-only) — there is no `permission.html`/`permission.js`. The per-platform selectors ship reasoned and
**founder-confirmed live per platform** (the browser runtime can't be exercised in the build sandbox), the same
honesty posture as the C.A.R.E adapters.

## How it's built (the C.A.R.E → Sales port)

Ported from `../extension`, adapting C.A.R.E → Sales, simpler (text-only, 5 tools, no media):

- **`background.js`** — toolbar-click inject (`config.js, adapters.js, content.js`); tool proxy (`sales-tool`;
  `ALLOWED_ENDPOINT = /^\/api\/coach\/extension\/[a-z-]+$/`; forwards `conversation`, `draft`/`intent`,
  `lastSpeaker`); on 401, `POST /api/coach/extension/refresh` + retry once, clearing the token + badge on
  failure; connect handoff (`onMessageExternal`, `sales-connect`). All `care-rcd-*`/`care-image-*` handlers
  dropped.
- **`content.js`** — shadow-DOM panel rendered from `SALES_TOOLS`. Input tools (coach/formulate) reveal a
  textarea (auto-focused, empty-guarded); the rest run on the captured conversation. Renders each result shape,
  with **Copy** on drafted output (excludes the internal reasoning), a distinct **session-expired** state, and a
  **truncation** notice when a capture is cut to the 20k cap.
- **`adapters.js`** — per-site DOM readers; reasoned-but-UNVERIFIED selectors, degrade to manual selection on a
  miss (never fabricate). Platform list + hostnames + reuse mapping in [`PLATFORM-COVERAGE.md`](./PLATFORM-COVERAGE.md).

## Related docs

- [`PLATFORM-COVERAGE.md`](./PLATFORM-COVERAGE.md) — every platform, its hostname, reachability, and adapter.
- [`CHROME-WEB-STORE-SUBMISSION.md`](./CHROME-WEB-STORE-SUBMISSION.md) — paste-ready store-listing package.
- [`../docs/SALES-COACH-EXTENSION-TESTING.md`](../docs/SALES-COACH-EXTENSION-TESTING.md) — the founder test runbook.
- [`../docs/SALES-COACH-EXTENSION-STATUS.md`](../docs/SALES-COACH-EXTENSION-STATUS.md) — status + the open founder decisions.
- Privacy policy: [`../src/app/extension/privacy-sales/page.tsx`](../src/app/extension/privacy-sales/page.tsx).

## What is guarded on every `npm run check`

`src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts` +
`salesExtensionConfigWiring.test.ts` + `salesExtensionBackgroundWiring.test.ts` assert: every `SALES_TOOLS`
endpoint maps to a real route; the token/config/tools globals are DISTINCT from C.A.R.E (both installable side
by side); adapter routing + the extraction contract (order, hidden-skip, never-fabricate, 20k cap); the panel's
Copy / sign-in / session-expired / empty-input guards; and the manifest's least-privilege surface (no unused
supabase/all-hosts/optional-host permissions).
