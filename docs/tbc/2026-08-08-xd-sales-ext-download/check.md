# CHECK — Sales Coach Extension: downloadable package + install page

## Verification (A38 — canonical command + the build, over what they cover)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test),
exit captured and gated on:

```
invariant:audit — Violations: 0
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2483 passed | 15 skipped
=== check exit code: 0 ===
```
Plus ad-hoc build verification this session:
```
$ node scripts/build-sales-extension-download.mjs
  ✅ wrote public/sales-coach-extension.zip (17754 bytes)  host_permissions: ["https://elostate.com/*","https://*.supabase.co/*"]
$ (loaded the zip) files: manifest/background/content/config/adapters + 3 icons · localhost stripped ✓
```
New test: `salesExtensionClientWiring.test.ts` — 10 cases (content.js clean-port + result shapes; adapters.js
Tier-1 coverage + no RCD helpers; the zip exists; the download page links the zip; the SC page links the page).

**Scope (A38 honesty):** the gate + the build cover the STATIC properties — the zip builds prod-hardened and
loads structurally, the links resolve, the client is a clean port. They do NOT exercise the Chrome install or
the panel's runtime (no browser here); that is founder-confirmed live, as labeled.

## Reachability (A31 — the full find→download→real seam)
```json
[
  {
    "feature": "Download + install the Sales Coach extension from the Sales Coach page",
    "files": ["src/app/dashboard/sales-coach/page.tsx", "src/app/extension/download-sales/page.tsx", "scripts/build-sales-extension-download.mjs", "public/sales-coach-extension.zip"],
    "write_path": { "exists": true, "where": "Sales Coach page → /extension/download-sales → download button → /sales-coach-extension.zip (built by the prebuild script)", "human_can_set": true },
    "read_path": { "exists": true, "where": "the rep downloads the real zip + follows the 5 install steps; the panel signs in and runs the tools", "human_can_see": "download/steps: YES (confirmed); the installed extension's RUNTIME: founder-live" }
  }
]
```
Both directions exist and are human-operable up to the install: the link is on the page, it reaches the
download page, the page links the real (built, checked) zip. The Chrome install + panel runtime are the
founder-live boundary, honestly named.

## Findings
no findings — the founder's request is delivered by mirroring the C.A.R.E flow; the build is prod-hardened +
confirmed; the client is a clean port locked by a guard; the honest boundaries (placeholder icon, browser
runtime) are labeled on the page + in the files, not faked. The connect handoff (first-token Sign in) remains
the one server piece still to build — flagged in closure, not implied done.
