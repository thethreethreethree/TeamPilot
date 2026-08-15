# BUILD — owner-or-manager gate on coaching-artifact readbacks

### FIX — getSession() pre-gate before each single-session events readback
read-path: `getSession(<id>)` (`src/lib/data/salesCoach.ts`) reads `coaching_sessions` via the
RLS user client; its SELECT policy is owner-or-manager (migrations 0083/0084), so a non-null
return proves the caller may read this session's artifacts and null means "not accessible."
write-path: each of the three GET handlers now calls `getSession(<id>)` and returns 404 on null
BEFORE the `events` read — mirroring the POST handler in the same file and the `/why` sibling.

- `src/app/api/coach/sales-session/dissect/route.ts` GET — gate before `coach.dissect_generated` read.
- `src/app/api/coach/sales-session/review/route.ts` GET — gate before `coach.sales_review_generated` read.
- `src/app/api/coach/sales-session/[id]/summarize/route.ts` GET — gate before the four `latest(kind)` reads.

No new imports needed — all three already import `getSession`. No behaviour change for the owner
or a same-company manager (both pass the gate); a peer rep now gets the honest 404 the write side
already returns.

### Structural guard (A30 — encode the class in a gate)
read-path: `src/app/api/coach/sales-session/__tests__/sessionArtifactReadGate.test.ts` scans every
`route.ts` in the sales-session tree, splits it into per-handler bodies, and for any handler that
reads a single session's events via `.eq("subject", `sales_session:${…}`)` asserts the same body
calls `getSession(`.
write-path: a NEW readback route that reads a session's `events` by request id without the gate
fails CI. The list route's set read (`.in("subject", subjects)` over an already company/agent-scoped
session query) is deliberately excluded — that is the gate at list grain, not an ungated request-id read.

## Why this shape (not events-RLS, not owner-only)
The `events` spine is company-wide by design (§3.1); authz for a rep-private artifact belongs on the
prior `coaching_sessions` gate, which already encodes owner-or-manager. Reusing `getSession` keeps ONE
definition of "who may read this session" (the sibling POST + `/why` already consume it), so the read
and write sides can't drift apart.
