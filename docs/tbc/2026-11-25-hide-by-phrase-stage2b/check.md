# CHECK - Service-role lists stop naming hidden calls (stage 2b)

## Commands

```
Explore agent (read-only) over src/app/api + src/lib → 7 paths naming/quoting a hidden call (A/B), 6 aggregate-only (C), writes to a hidden call's score via comment/share/override
node replay0340.mjs → before 0340: {"rep":false,"own_admin":false,"manager":true,"other_company_admin":false} · after: {"rep":false,"own_admin":false,"manager":true,"other_company_admin":true}
npm run db:apply → applying 0340_hide_admin_same_company.sql … ok · ALL 33 invariants hold
npx vitest run (touched routes) → first: 14 failed (disputes, override — mocks without the hide check) → hide mocked + hidden tests added → pitch-score 190 passed
npx vitest run coaching-inbox → 4 passed · sales-session/list → first ✗ (mock had no profiles table) → 21 passed · calibration → first ✗ (400: my test body was invalid) → 13 passed · coaching-metrics → 6 passed · pitch-recordings → 12 passed · share (new) → first ✗ 401 (auth not mocked) → 3 passed · monitoring → 7 passed · askCoach + listChats → 13 passed
```

## Findings

### F1 - managers could see hidden calls in service-role lists
class: a database hide doesn't reach reads made with the service role; the manager gate admits sales-coach admins whom the hide does apply to.
sweep: every service-role call read the search found that names or quotes a call now checks the SQL rule (A and B lists); aggregates that name no call are filtered where the same route lists calls (coaching metrics), otherwise recorded.
severity: high

### F2 - a manager could comment on, share or correct a hidden call
class: write routes checked the tree, not the hide.
sweep: comment, share request, score correction and calibration submit refuse a hidden call (404), tested.
severity: medium

### F3 - the rule's admin exemption ignored the viewer's company
class: a predicate that relied on RLS's company pin, called from outside RLS.
sweep: 0340; replay shows another company's admin is hidden-from, own admin and rep exempt.
severity: medium

### F4 - the hidden route re-derived "can see"
class: §2.2 duplicate condition.
sweep: it now takes hiddenFrom's verdict; route test mocks the verdict, not the inputs.
severity: low

## Final

```
npm run check → first ✗ tbc:manifest (§3.1.1 reason too short) → rewritten → exit 0 · Test Files 947 passed | 1 skipped · Tests 6873 passed | 15 skipped
```
