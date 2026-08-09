# C.A.R.E — Remote Code Declaration

_Maps to: Developer Dashboard → Privacy practices → "Are you using remote code?"_

## Answer: **No.**

The C.A.R.E extension does **not** load or execute any remotely hosted code. All JavaScript, HTML, and CSS that
runs is contained in the uploaded package (`manifest.json`, `background.js`, `content.js`, `config.js`,
`adapters.js`, `permission.js`, `permission.html`). This is Manifest V3, which prohibits remotely hosted
executable code, and the extension complies:

- No `eval()`, no `new Function()`, no remote `<script src>` injected into pages.
- No dynamically fetched-and-executed scripts.
- The background service worker makes ordinary `fetch` **data** calls: JSON/text results from the backend
  (`elostate.com`), and — for Capture only — direct media-byte uploads (`PUT`) to a signed `*.supabase.co`
  storage URL. None of these retrieve executable code.

_Verified from the source; the only network traffic is data requests to the backend plus opt-in media uploads
to the user's own workspace storage._
