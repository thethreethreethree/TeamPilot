# BUILD — Sales Coach Extension, Phase 2b-worker: the service worker

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### The MV3 service worker (ported from C.A.R.E, sales-adapted)
`extension-sales/background.js` (new).

- **write-path:** toolbar-click injects config/adapters/content; the panel posts `sales-tool` here; the
  worker (CORS-free, holds host_permissions) validates the endpoint against `ALLOWED_ENDPOINT`
  (`/^\/api\/coach\/extension\/[a-z]+$/`), forwards only known inputs (conversation/draft/intent/lastSpeaker),
  and calls the API with the stored `salesCoachToken`. On 401 it refreshes via `/api/coach/extension/refresh`
  and retries once. `onMessageExternal` `sales-connect` stores the token from the connect page; the badge
  tracks the session.
- **read-path:** the panel (Phase 2b) reads `{status, data}` back; the RUNTIME behavior is confirmed live by
  the founder (no browser in the sandbox). Statically, the port-guard test reads the file.

### Static port-completeness + allowlist guard
`src/lib/coach/extension/__tests__/salesExtensionBackgroundWiring.test.ts` (new).

- **write-path:** reads `background.js`; asserts sales message types/keys present, NO `care-*`/`careToken`/RCD
  leftovers, the coach refresh route (not care), and — extracting the real `ALLOWED_ENDPOINT` regex — that it
  admits the 5 tool routes and rejects traversal + cross-host + the C.A.R.E namespace.
- **read-path:** runs in `npm run check`; a half-done port or a widened allowlist fails the gate.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** a faithful port; the shared refresh route reused, RCD/image dropped as out-of-scope. Sound.
- **L2 effect:** the verifiable parts (syntax, allowlist, port-completeness) pass; the Chrome-API runtime is
  NOT sandbox-verifiable and is honestly labeled founder-live. Bounded, not overclaimed.
- **L3 continuity:** the worker is one piece; a rep can't use anything until the panel (content.js) + adapters
  + connect page + icons land. Sequenced, not stalled.
- **L4 surface:** none in the worker (no UI); the panel is next.

## Verdict: SHIPPABLE-WITH-FOLLOWUP
The worker is a faithful, statically-checked, honestly-labeled port. The extension is NOT loadable until the
remaining client pieces land (panel, adapters, connect page, icons) — named in check.md, not hidden.

## Files
- `extension-sales/background.js`
- `src/lib/coach/extension/__tests__/salesExtensionBackgroundWiring.test.ts`
