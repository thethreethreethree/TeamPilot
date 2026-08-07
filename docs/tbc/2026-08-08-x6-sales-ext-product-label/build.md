# BUILD — Sales Coach Extension: product label in the entitlement 402

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Parameterize the entitlement 402 product label (shared auth)
`src/lib/api/extensionAuth.ts`, `src/lib/api/extensionGuard.ts`.

- **write-path:** `requireEntitledExtensionUser(req, { productLabel? })` — `productLabel` defaults to
  "C.A.R.E extension" and is interpolated into both 402 messages. `guardExtensionRequest` gains an optional
  `productLabel` in its opts and passes it through. C.A.R.E callers (which omit it) are unchanged.
- **read-path:** the 402 body `error` string is read by the extension client and by the auth test; a locked
  caller now reads the label for the surface they are on.

### The four sales routes opt into the sales label
`src/app/api/coach/extension/{dissect,coach,summarize,copilot}/route.ts`.

- **write-path:** each `guardExtensionRequest(...)` opts now include `productLabel: "Sales Coach extension"`.
- **read-path:** a locked Sales Coach user's 402 now says "Sales Coach extension", never "C.A.R.E".

### Tests
`src/lib/api/__tests__/extensionAuth.test.ts` (+3 cases).

- **write-path:** new cases assert the default (no label → C.A.R.E string, unchanged), the sales label (→
  Sales Coach string, `not.toContain("C.A.R.E")`), and the not-included variant.
- **read-path:** `npm run check` runs them; the C.A.R.E extension route tests + the existing auth cases are
  unaffected (ripple containment — the default reproduces the original strings).

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** one optional param on a shared function, default-preserving. Sound, minimal blast radius.
- **L2 effect:** a locked caller gets the correct product name; tested for both C.A.R.E (default) and sales.
- **L3 continuity:** the client already reads `error`/`entitlement` from the 402 body — no client change
  needed; the message is just correct now.
- **L4 surface:** the copy a locked user reads matches the product they opened. Aligned.

## Verdict: SHIPPABLE
Decision-independent honesty fix with contained ripple (C.A.R.E unchanged, verified). The entitlement SOURCE
decision (shared vs separate SKU) is scoped out to the founder, not guessed.

## Files
- `src/lib/api/extensionAuth.ts`
- `src/lib/api/extensionGuard.ts`
- `src/app/api/coach/extension/dissect/route.ts`
- `src/app/api/coach/extension/coach/route.ts`
- `src/app/api/coach/extension/summarize/route.ts`
- `src/app/api/coach/extension/copilot/route.ts`
- `src/lib/api/__tests__/extensionAuth.test.ts`
