# Sales Coach — Remote Code Declaration

_Maps to: Developer Dashboard → Privacy practices → "Are you using remote code?"_

## Answer: **No.**

The Sales Coach extension does **not** load or execute any remotely hosted code. All JavaScript, HTML, and CSS
that runs is contained in the uploaded package (`manifest.json`, `background.js`, `content.js`, `config.js`,
`adapters.js`). This is Manifest V3, which prohibits remotely hosted executable code, and the extension
complies:

- No `eval()`, no `new Function()`, no `<script src="https://…">` injected into pages.
- No dynamically fetched-and-executed scripts.
- The background service worker makes ordinary `fetch` **data** calls to the extension's own backend
  (`elostate.com`) — it retrieves JSON/text results, never executable code.

_Verified by `scripts/build-sales-extension-download.mjs` (MV3 validation) and the source; the only network
traffic is data requests to the backend._
