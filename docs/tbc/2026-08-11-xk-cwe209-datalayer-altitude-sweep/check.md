# CHECK — CWE-209 data-layer altitude sweep

## Verification run (A38 — canonical command + exit code)
```
$ npx vitest run "src/lib/data/__tests__/chats"
 Test Files  3 passed (3)
      Tests  16 passed (16)
VITEST_EXIT=0
$ npm run check
  Violations: 0
 Test Files  391 passed | 1 skipped (392)
      Tests  2685 passed | 15 skipped (2700)
CHECK_EXIT=0
```
The updated `chats.fetchTopics.test.ts` asserts the live-error string is generic (not the raw "42P01: view is
stale"), while keeping the `mode === "live-error"` INV22 assertion — so a future revert to the raw string fails
the test.

## Findings

### F1 — chats.fetchTopics rendered a raw Postgres code+message in the member's chat UI
file+line: `src/lib/data/chats.ts:542` (pre-fix) — `error: `${code}: ${error.message}`` returned in the live-error result, rendered at `chats/page.tsx:103` as "Could not load topics — 42P01: relation … does not exist".
class: CWE-209 raw-DB-error-to-client at the DATA-LAYER altitude (a read fn's result string rendered by the UI) — the same class as the route-level leaks, one layer down; a test had locked it as correct.
severity: low — authed team member; a Postgres SQLSTATE + relation name, not a secret.
sweep-command: `grep -rnE "error:\s*[A-Za-z_$][\w$]*\??\s*\.\s*message" src/lib` + the nested/two-step/interpolated variants, then trace each consumer. Only chats reached a client render; the rest were contained/logged/curated.

## Audit-clean (non-defect) — the rest of the src/lib hits
`assets.ts` (`uploadAssetBytes`/`createSignedUploadTarget`) return a raw `msg` but every caller genericizes it
(F2/F6/xh), and the bucket-not-found branch is a deliberate operator-actionable message. `outbound.ts`'s raw
`${e.message}` is `console.error`-logged by both callers, never returned to a client. `extensionAuth.unauth`
takes a caller-supplied curated string. `useSseStream` is client-side error state. No finding — the bounded,
consumer-traced result is on the record.
