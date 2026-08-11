# CLOSURE — CWE-209 data-layer altitude sweep + chats fix

## What shipped
Swept the CWE-209 raw-error class at the `src/lib` (helper/data-layer) altitude — the source of the field-shape
leaks xi/xj fixed at the route altitude. One real client-facing leak: `chats.fetchTopics` returned a raw
Postgres code+message that the chat UI rendered to an authed member (and a test had LOCKED that leak). Fixed:
generic client string, raw cause stays in `console.error`, `mode:"live-error"` (INV22) unchanged; the test now
locks the generic behavior. Every other src/lib raw-`.message` was consumer-traced and is contained
(genericized at callers), logged-not-returned, or a curated/caller-supplied string.

## Un-named reliances (A35 — name them)
- **The `live-error` MODE carries the error-vs-empty signal, not the string.** The fix relies on consumers
  keying on `mode`, not parsing the `error` text — true today (`chats/page.tsx` branches on `mode`).
- **outbound's raw string is logged, not returned.** Both `dispatchOutboundEmailReply` callers `console.error`
  `r.error`; the "clean" verdict depends on that staying true — a future caller that returned `r.error` to a
  client would re-open it (caught by the route-level invariant 14 / xj gate at the route).
- **The assets helpers' raw `msg` is genericized by every caller.** Same route-level backstop applies.

## Residual (A36 — ranked by confidence-it-does-not-matter; top must be OPENED)
```json
[
  { "id": "R1", "item": "outbound.ts's raw ${e.message} could reach a client if a future caller returns r.error instead of logging it.", "why_skipped": "Both current callers console.error it; not a live leak.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T19:12:00Z", "outcome": "Traced both callers (care/agent/.../messages:196 and care/inbound/email:749-753): each console.error's r.error and neither returns it in a NextResponse to a client — the dispatch is async after the message already posted. Confirmed NOT a live leak. A future caller that forwarded r.error raw at a 5xx would be caught by invariant 14 at the route (it interpolates .message). No action; left as-is." },
  { "id": "R2", "item": "The assets helpers (uploadAssetBytes/createSignedUploadTarget) still RETURN a raw msg in .error.", "why_skipped": "Deliberate: the bucket-not-found branch is an operator-actionable message, and all four current callers genericize before the client. Genericizing the helper itself would lose the operator diagnostic. The gate belongs at the route (invariant 14), where it already is.", "confidence_it_does_not_matter": "medium", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations: 0
tbc ✓ — docs · manifest (12) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 390 passed | 1 skipped (391); Tests 2684 passed | 15 skipped (2699)
CHECK_EXIT=0
```
