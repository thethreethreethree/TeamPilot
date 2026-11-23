# REMEDIATE - Coaching export

### F1 - req.nextUrl in a route whose tests pass a plain Request
Fixed: new URL(req.url).
gate-or-promise: gate (export.test.ts calls the route with a plain Request)

### F2 - no monthly coaching email
gate-or-promise: promise (OPEN.md "monthly coaching email to managers")
