# C.A.R.E — Permissions Justifications

_Paste each justification into the matching field: Developer Dashboard → Privacy practices → "Permission
justification". C.A.R.E requests more than Sales Coach because of the optional Capture-media feature — expect a
closer review, so the justifications for the Supabase host and the optional all-hosts permission matter most._

Declared in `extension/manifest.json` (production build strips `localhost`):
`permissions: ["activeTab", "scripting", "storage"]`,
`host_permissions: ["https://elostate.com/*", "https://*.supabase.co/*"]`,
`optional_host_permissions: ["*://*/*"]`.

| Permission | Justification (paste) |
|---|---|
| `activeTab` | Used only when the user clicks the C.A.R.E toolbar icon, to read the conversation on that one active tab so the extension can assist it. Nothing runs in the background and no other tabs are accessed. |
| `scripting` | Injects the assistant panel into the active tab (via `chrome.scripting.executeScript`) at the moment the user clicks the icon. No injection without that explicit user gesture. |
| `storage` | Stores the user's own account session token (and its refresh token) in `chrome.storage.local` so they stay signed in between page visits, plus an optional backend-URL setting. No conversation content is stored. |
| Host `https://elostate.com/*` | The extension's own backend. The background service worker calls it (with the user's token) to run the tools. |
| Host `https://*.supabase.co/*` | **Capture feature only.** When the user saves a conversation's media (images) to their workspace, the worker uploads the image bytes directly to a per-file **signed URL** on the workspace's storage provider (Supabase), so large media never traverses our API's request-body limit. The destination URL is pinned to `*.supabase.co` in code so it cannot be turned into an open upload proxy. |
| `optional_host_permissions: *://*/*` (OPTIONAL — not requested at install) | **Capture feature only.** To include a conversation's cross-origin images in a Capture, the worker must fetch those image bytes, which requires host access to the image's origin. This is an **optional** permission the user explicitly grants through a permission page, and only the first time they Capture media. It is never requested on install; the extension works fully without it (in which case captured media is stored as metadata only, without the image bytes). |

## Confirmations for the reviewer
- **No unused permissions.** `activeTab`/`scripting`/`storage`/`elostate.com` power the tools; `*.supabase.co`
  and the optional `*://*/*` power the opt-in Capture-media flow only.
- **The all-hosts grant is optional and user-initiated**, requested at runtime with a clear purpose (fetching
  image bytes the user chose to capture), not a broad install-time permission.
