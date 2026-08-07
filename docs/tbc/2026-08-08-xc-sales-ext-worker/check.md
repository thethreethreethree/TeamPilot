# CHECK — Sales Coach Extension, Phase 2b-worker

## Verification (A38 — the canonical command, by name, coverage + exit — AND its honest scope)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Violations: 0
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2483 passed | 15 skipped
=== check exit code: 0 ===
```
Exit confirmed BEFORE committing (captured `rc=$?`, gated on it — after re-learning earlier this session that
a `;`-chain commits past a non-zero exit; vitest ≠ typecheck).

New test: `salesExtensionBackgroundWiring.test.ts` — 11 cases (clean-port invariants + the endpoint allowlist
exercised against the real routes).

**Scope (A38 honesty):** `npm run check` covers the STATIC properties of `background.js` — syntax, the
security allowlist, port-completeness. It does NOT and CANNOT exercise the Chrome-API runtime (chrome.scripting
/runtime/storage/action) — there is no browser here. That runtime is confirmed LIVE by the founder, same as
the C.A.R.E worker. Ad-hoc static checks also run this session: `node --check` (valid JS), the allowlist
against the 5 endpoints (all admit; traversal/cross-host reject), and `grep` for zero C.A.R.E leftovers.

## Reachability (A31 — assert the seam, and name exactly what is NOT built)
```json
[
  {
    "feature": "Sales Coach extension service worker (tool proxy + refresh + connect receiver)",
    "files": ["extension-sales/background.js"],
    "write_path": { "exists": true, "where": "panel posts sales-tool → worker validates + calls the coach tool route; sales-connect stores the token", "human_can_set": "NOT YET — no panel posts to it, and no connect page sends a token (both still to build)" },
    "read_path": { "exists": true, "where": "worker returns {status,data}; the panel renders it", "human_can_see": "NOT YET — the panel (content.js) is the next piece" }
  }
]
```
**Still to port before the extension is loadable (honestly named):** `content.js` (the panel), `adapters.js`
(the Tier-1 per-site readers — see `extension-sales/PLATFORM-COVERAGE.md`), the `/extension/connect` handoff
page, and `icons/`. The worker alone is not a usable extension.

## Findings
no findings — a faithful port with the shared refresh route reused (not forked), the RCD/image machinery
correctly dropped, and the security allowlist + port-completeness locked by a test. The one thing that can't
be checked here — the Chrome-API runtime — is labeled unverified in the file, the README, and above, and is
sequenced to the founder's live confirmation, not claimed.
