# CHECK — "I pressed score them all and nothing happened" + the multi-tenant sweep

## Commands

```
$ npx tsc --noEmit -p tsconfig.json                          → exit 0
$ npx vitest run UnscoredBacklog + backfill + pitchScore      → 16 files, 281 passed
$ npm run check                                               → see closure
```

## Part 1 — the button

### What I could prove, and what I could not

**[OBSERVED]** `80a6e491` (this morning's `errored` fix) is on `origin/main`. The deploy has it.
So the founder was pressing the FIXED build. My deploy-lag hypothesis is dead.

**[OBSERVED]** Every failure path I built attaches words: `!res.ok` sets a note carrying the
server's own `error` string; a thrown fetch sets the connection note; `rateLimit` returns a JSON
body with `error`, so even a 429 has a sentence. `note` IS rendered, at `:190`.

**[INFERRED]** Therefore a run that displays NOTHING is not reaching any of those paths. It is
*succeeding*.

### The defect: a successful finish blanked its own report

class: silence read as success (§1.5.3, the same class as this morning's error path)
severity: high — it makes a working feature indistinguishable from a dead button

**[OBSERVED]** `route.ts:259-265` sets `note` to **null** on every ordinary completion. Non-null
only when `haltedBy` is set, or when `scored === 0 && remaining > 0`.

**[OBSERVED]** The client's last act was `setNote(body.note)` — so a finished run *cleared* the one
element that could have reported it. Button un-disables, no text appears.

**[OBSERVED]** A drain that scores 100 of 194 and stops with 94 permanently-unscorable takes the
`scored > 0` branch → `note: null` → **silence after real work**.

**[OBSERVED]** The panel also self-hides at `unscored === 0 && scoredSoFar === 0`, so a run ending
at zero can take its own answer off screen with it.

### The second defect, provable by arithmetic

**[OBSERVED]** `BATCH = 8`. 194 recordings need **25 POSTs**. The POST limiter is
`max: 12, windowMs: 60_000`. The loop could not finish — pass 13 is a 429.

**[OBSERVED]** It only bites when passes return FAST, which is precisely when recordings are being
*refused* rather than graded: `no_agent_turns` is decided before any LLM call
(`generatePitchScore.ts:95`), so a refusal costs ~nothing and the loop spends its whole minute's
budget in seconds.

**[OBSERVED]** The limiter was respected rather than raised past the point of being a limiter: the
client now waits the `Retry-After` the route already sends, bounded at `MAX_WAITS = 30`.

### Mutation-tested

Both defects restored; **3 of 12 fail**:
```
× says what it did when the server sends no note
× says so when it scored nothing and the server gave no reason
× waits out a 429 and carries on instead of calling it an error
```

## Part 2 — multi-tenant isolation

Asked for directly: *"Make sure that each of the company's data is restricted to each company."*

### A scanner of mine was wrong first, and I caught it by reading a member

**[OBSERVED]** My first RLS sweep reported **49 tables created with no RLS**, including
`pitch_scores` — the table this whole backfill writes to. It was a **regex artefact**: the
migration reads `alter table pitch_scores        enable row level security;` with multiple spaces,
and my pattern required exactly one. Corrected with `[[:space:]]+`.

**Fifth bad scanner of this session.** It would have handed the founder a fabricated list of 49
unprotected tables. Caught only because I checked `pitch_scores` by name instead of believing the
count.

### What the corrected sweep found

**[OBSERVED]** **153 of 154** tables have `enable row level security`. The 154th is `if`, a parse
artefact of `create table IF NOT EXISTS`.

**[OBSERVED]** **457 policies.** **Zero** contain `using (true)`.

**[OBSERVED]** The boundary is defined **once**, not copied per policy —
`auth_company_id()` at `0001_init.sql:99`, `security definer`,
`select company_id from profiles where id = auth.uid()`. This is §2.2 (consume the verdict, don't
re-derive the gate) applied at the database layer.

**[OBSERVED]** `pitch_scores` policy (`0252:238`) is `company_id = auth_company_id() and (rep_id =
auth.uid() or is_sales_coach_manager())` — company AND ownership. Child tables re-assert company and
`exists` back to the parent, plus a `pitch_child_company_matches()` trigger.

**[OBSERVED]** `pitch_scores` has **no insert or update policy at all**, deliberately. A rep cannot
write their own score; a manager corrects through the logged override path.

### The service-role surface — where RLS does NOT protect

**[OBSERVED]** 68 non-test routes use `createAdminClient()`, which bypasses RLS by construction.
**7** never mention company scoping. All 7 scope by something **narrower** than company:

| route | what bounds it |
|---|---|
| `coach/sales-session/my-training` | `.eq("actor", uid)` — caller's own events |
| `team/set-password` | `.eq("id", ctx.userId)` — caller's own profile row |
| `coach/gamification/notifications` | `.eq("recipient_id", ctx.userId)` |
| `chat/topics/[id]/lock` | reads topic, then `created_by !== auth.user.id` → 403 |
| `care/conversations/[id]/file/[fileId]` | 401 without session token, then `linked_conversation_id !== conversationId` → null |
| `care/extension/dissect` | `.eq("id", user.userId)` |
| `care/rcd/retention-cron` | cross-tenant **by design**; `CRON_SECRET` via `constantTimeEqual`, **503 when unset** |

### IDOR sweep — the shape RLS cannot catch

A service-role query keyed on an id straight from the URL reads any tenant's row by guessing.
**[OBSERVED]** 17 call sites match that shape. Each was **read**, not counted. Every one has its
guard ABOVE the query — which is why a query-local scanner flags them:

- `files/[id]/access:49-54` — `isUploader || (isAdmin && sameCompany)` → 403, with a comment
  stating it enforces *more* than RLS did.
- `coach/sales-session/[id]/attribute-unlabelled:80-86` — 401, then `callerCompanyId`, then 403.
- `coach/meeting-session/[id]/dissect:44` — *"Only the session's facilitator can review it"* → 403,
  narrower than company.

## What this does NOT prove

**[ASSUMED]** I read the **migrations**, not the live database. A migration that was never applied,
or a policy dropped by hand in the Supabase dashboard, is invisible to this sweep — the §1.5.3
external-config class exactly. Verifying the live `pg_policies` is the honest next step and it is
config the repo cannot hold.

**[OBSERVED]** I did not re-verify the 61 service-role routes that DO mention `company_id`. A route
can mention it and still have one query that forgets it. The 7-and-17 sets are complete; that set
is not.

**[INFERRED, NOT OBSERVED]** I still cannot name the exact cause of "nothing happened". I fixed two
defects that each produce that symptom and instrumented the panel so the next press reports itself.
Claiming the cause is found would be the §5 confident-well-formed-failure.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed this
pass. No captures were generated.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, `/kpi` `/team-chat` `/door`, `VoiceEnrollment`, two of DoorLog's four states, `RepActivity`,
the `captureStalled` warning, the live `pg_policies` table, and the 61 service-role routes named
above.
