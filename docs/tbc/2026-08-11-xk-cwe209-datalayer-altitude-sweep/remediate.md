# REMEDIATE — CWE-209 data-layer altitude sweep

### F1 — chats.fetchTopics raw DB error in the UI
fix: return a generic client string ("please try again in a moment") from the live-error branch; keep the raw `console.error` + the `mode: "live-error"` (INV22). `chats.ts:542`.
gate-or-promise: gate. `chats.fetchTopics.test.ts` (updated) asserts `mode === "live-error"` AND `error` does NOT contain "42P01"/"view is stale" AND equals the generic string — the same test that previously locked the leak now fails on any revert to the raw message.
