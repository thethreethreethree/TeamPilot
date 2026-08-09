# Sales Coach — Permissions Justifications

_Paste each justification into the matching field: Developer Dashboard → Privacy practices → "Permission
justification" (one box per permission, auto-populated from `manifest.json`)._

Declared in `extension-sales/manifest.json` (production build strips the `localhost` entries):
`permissions: ["activeTab", "scripting", "storage"]`, `host_permissions: ["https://elostate.com/*"]`.
**No `<all_urls>`, no `tabs`, no `history`, no optional host permissions, no Supabase host** — the lean,
least-privilege set.

| Permission | Justification (paste) |
|---|---|
| `activeTab` | Used only when the user clicks the Sales Coach toolbar icon, to read the conversation on that one active tab so the extension can coach it. Nothing runs in the background and no other tabs are accessed. |
| `scripting` | Injects the coaching panel into the active tab (via `chrome.scripting.executeScript`) at the moment the user clicks the icon. No injection happens without that explicit user gesture. |
| `storage` | Stores the user's own account session token (and its refresh token) in `chrome.storage.local` so they stay signed in between page visits, plus an optional backend-URL setting. No conversation content is ever stored. |
| Host permission `https://elostate.com/*` | The extension's own backend and only network destination. The background service worker calls it (with the user's token) to run the coaching tools. |

## Confirmations for the reviewer
- **No unused permissions.** Every declared permission is used by the code paths above (verified by
  `scripts/build-sales-extension-download.mjs`, which validates the package and strips dev-only `localhost`).
- **Narrowest host match.** The only host permission is the extension's own backend (`elostate.com`), not
  `<all_urls>` or per-site hosts — page access comes from `activeTab` on the user's click.
