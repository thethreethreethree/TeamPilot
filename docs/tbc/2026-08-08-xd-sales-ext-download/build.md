# BUILD — Sales Coach Extension: downloadable package + install page

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Complete the loadable client package
`extension-sales/content.js` (panel), `extension-sales/adapters.js` (7 Tier-1 readers), `extension-sales/icons/*`.

- **write-path:** content.js renders SALES_TOOLS + the coach/formulate input boxes, captures the conversation
  (salesAdapterFor or manual selection), posts `sales-tool` to the worker, renders each tool's result shape.
  adapters.js exposes `salesAdapterFor` + `textFrom` for gmail/outlook/instagram/messenger/whatsapp/linkedin/
  slack (+ WhatsApp `lastSpeaker`). icons are C.A.R.E placeholders (manifest references them).
- **read-path:** the rep sees the rendered coaching in the panel (runtime founder-live). Statically, the
  client-wiring guard reads these files (clean port + result shapes).

### The download build + served zip
`scripts/build-sales-extension-download.mjs`, `package.json` (prebuild), `public/sales-coach-extension.zip`.

- **write-path:** the script strips localhost, validates (mv3 / 128-icon / description<132 / files present),
  and zips `extension-sales/` → `public/sales-coach-extension.zip`, deterministically. `prebuild` runs it
  after the C.A.R.E build.
- **read-path:** the zip is served at `/sales-coach-extension.zip`; the built artifact is committed + rebuilt
  on deploy. (Manifest description shortened 142→<132 to pass the CWS cap.)

### The download + install page, linked from the Sales Coach page
`src/app/extension/download-sales/page.tsx`, `src/app/dashboard/sales-coach/page.tsx`.

- **write-path:** the page (version single-sourced from the manifest) has the download button
  (`/sales-coach-extension.zip`) + five install steps + a "Good to know". The Sales Coach dashboard (mobile +
  desktop) links to `/extension/download-sales`.
- **read-path:** a rep on the Sales Coach page sees "Get the Sales Coach browser extension", clicks through to
  download + install steps, then signs in from the panel.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** mirrors the C.A.R.E download flow (build/page/link); deterministic zip; single-sourced
  version. Sound.
- **L2 effect:** the build produces a prod-hardened, loadable zip (checked: localhost stripped, all files
  present, loads structurally); the download link resolves.
- **L3 continuity:** the founder's ask — the page leaves the rep flowing: download → 5 steps → pin → Sign in →
  use, exactly the C.A.R.E arc. Not a dead end.
- **L4 surface:** the download link is on the Sales Coach page (both layouts) + a full sales-branded install
  page.

## Verdict: SHIPPABLE
Delivers the founder's request (download link + install instructions on the Sales Coach page), mirroring
C.A.R.E, with the build checked and the client-runtime honestly labeled founder-live. Follow-ups (a sales
icon, the connect handoff) are flagged, not faked.

## Files
- `extension-sales/content.js`
- `extension-sales/adapters.js`
- `extension-sales/icons/icon16.png`, `icon48.png`, `icon128.png`
- `extension-sales/manifest.json` (description shortened)
- `scripts/build-sales-extension-download.mjs`
- `package.json` (prebuild)
- `public/sales-coach-extension.zip`
- `src/app/extension/download-sales/page.tsx`
- `src/app/dashboard/sales-coach/page.tsx`
- `src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts`
