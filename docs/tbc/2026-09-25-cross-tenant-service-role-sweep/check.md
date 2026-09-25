# CHECK — the service-role routes, query by query

Closes residual R2 of `2026-09-25-nothing-happened-and-the-tenant-boundary`: 61 service-role routes
that mention `company_id` but had not been read query-by-query.

## Method

For every `.from(...)` chain in those 61 files with no company term inside the chain itself, print
the RECEIVER (which client) and the FILTER (what it is keyed on). 54 chains; 4 were noise
(`Array.from`, `Buffer.from`, storage buckets). A chain is a SUSPECT, never a finding, until the
lines above it are read — a query-local scan cannot see a guard.

## Read and found safe

- **[OBSERVED]** 7 admin `profiles .eq("id", X)` — X is `user.userId` / `auth.user.id` in every one
  (care/extension ×5, corpus, product). The caller's own row.
- **[OBSERVED]** `coach/sales-session/patterns/event:64` — reads the pattern, then
  `pattern.company_id !== ctx.companyId` → 404 at :68; the update at :117 is after it.
- **[OBSERVED]** `coach/sales-session/[id]/why:34` — `readLatestWhy` has one caller (:97), after an
  RLS-scoped `getSession` and the owner-or-manager gate.
- **[OBSERVED]** `notifications/notify-message:99` — :67 requires the caller to be the AUTHOR of the
  message and the message to belong to `body.topicId`.
- **[OBSERVED]** `care/agent/conversations/[id]/messages:273` — `messageId` is `msg.id`, the message
  this request created after its 404 gates at :79/:85.
- **[OBSERVED]** `files/[id]` PATCH:104 — only after `classifyFile`, which uses the user client,
  checks rows-affected and ends in RLS-scoped `getFile`; a foreign id returns null first. DELETE
  gates uploader-or-same-company-admin at :177-182.
- **[OBSERVED]** `coach/gamification/calibration` GET:87 — session ids come from summaries already
  filtered to `mgr.companyId` at :55.

## Finding 1 — cross-tenant READ, fixed

class: service-role read keyed on a client-supplied id with no company term
severity: medium — needs a known UUID, not enumerable — but it is exactly the class asked about

**[OBSERVED]** `POST /api/coach/gamification/calibration` read `after_pitch_summaries` by
`body.sessionId` alone on the service role and returned the model's scores. A manager at company A
posting a session id from company B received B's opener / objection / tone / close / next-step, and
left a calibration row tagged A pointing at B's pitch.

Fix: the summary is read FIRST, filtered by `mgr.companyId`; absent → 404 before any write.

**[OBSERVED]** Why the tests missed it: the route test's builder ignores `.eq` arguments, so a
filtered and an unfiltered read were the same read. The new test's builder honours filters.
Mutation: remove the company filter → the cross-tenant test fails (1 of 9).

## Finding 2 — cross-tenant WRITE to identity, NOT fixed: the founder's call

`team/add-member` "existing" mode upserts ANY account found by email into the caller's company
(:66-70). It reads the person's current `company_id` and uses it only to decide whether to keep
their role. Combined with open `/login` signUp (`login/page.tsx:92`) and
`complete_company_onboarding` granted to every authenticated user (`0047:118`, makes the caller
`'admin'` of a new company), a stranger can move a customer's user — their CEO included, demoted to
Member — into the stranger's company.

**[ASSUMED]** Depends on live Supabase signups being enabled, which the repo cannot show.

Not fixed unilaterally: the file header records a founder ruling — *"the multi-company complication
is a deliberate DEFERRED item per the founder — for now the add is direct."* Refusing cross-company
adds changes that ruling, so it goes to him in a picker.

## Not yet read

`coach/sales-session/team-analytics` and `list` (`.in(...)` over ids — safe only if the id lists are
derived from company-scoped reads), `care/inbound/email` (webhook, 11 chains), the three crons
(covered by the gate's CRON_SECRET invariant, not re-read here), `team/route.ts` (user client).

## Not opened

No image, icon, logo, favicon or graphic asset was touched. No captures generated.
