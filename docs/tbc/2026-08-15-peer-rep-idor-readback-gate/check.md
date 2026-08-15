# CHECK — peer-rep IDOR readback gate

## Verification run (A38)
Canonical command: `npm run check`. Full output + exit code pasted in closure.md.

## Findings

### F1 — three GET readbacks returned a rep's private coaching artifact to same-company peers (IDOR)
file+line: `dissect/route.ts` GET, `review/route.ts` GET, `[id]/summarize/route.ts` GET — each read
`events` by `kind` + `subject = sales_session:<id>` with no ownership check.
class: **IDOR / broken cross-person read** — `events` RLS is company-wide (0004/0103), so subject-only
filtering leaks any same-company session's artifacts to a peer who supplies the id.
severity: MEDIUM — same-company only (not cross-tenant), read-only, private coaching content.
read-path: fixed — a `getSession(<id>)` pre-gate (owner-or-manager RLS, 0083/0084) returns 404 for a peer
before the events read.
write-path: `sessionArtifactReadGate.test.ts` fails CI on any NEW single-session `.eq("subject", …${id})`
readback that omits the gate. Detection-proven: stripping the gate makes the guard fail the build; restoring
it makes the guard satisfied again (both runs captured this session).
sweep-command: `grep -rn 'subject.*sales_session:' src/app/api/coach/sales-session` — the three readbacks
plus `list` (set read over an already company/agent-scoped session query — safe, excluded with rationale).

## Adjacent surfaces (§1.5.2)
`list/route.ts` safe (list-grain gate); `[id]/why/route.ts` already gated (the model); owner-only
after-pitch/summary-scores out of scope (tighter gate). Details in remediate.md.

## Tests
```
$ npx vitest run sessionArtifactReadGate
 Test Files  1 passed (1)
 Tests  6 passed (6)
```
Full gate + exit code in closure.md.
