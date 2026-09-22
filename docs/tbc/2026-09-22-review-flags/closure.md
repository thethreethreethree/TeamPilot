# CLOSURE — the rude-flag review queue

## What is true now

Every line on the Coach Assessment board that said "not built" is gone, and none of them was
deleted — each was replaced by the thing it was apologising for.

More precisely: **the one verdict in this product that an LLM should not be allowed to make alone
now requires a person.** A −10 for being rude is the largest single deduction in the rubric,
larger than any bonus, and it rests on a model's reading of someone's manner. It now sits in a
queue until a human confirms or removes it, and either answer reaches the rep with a reason.

## What I am relying on that nobody named

1. **No rude flag has ever been written.** `viol.rude` is a valid violation the scorer can emit,
   and whether it has ever fired on real audio is unknown to me. The queue is correct and may be
   permanently empty — which is a good outcome and an untested code path. The empty state is
   tested; the populated one is tested only against fixtures.

2. **Confirm writes an override that changes nothing.** `apply_pitch_score_override` recomputes
   through `scorePitch` either way, so a confirm should produce an identical total. *Should.* If
   the recompute is not perfectly idempotent — a rounding path, a re-scaled Delivery section — a
   confirmation would silently move a rep's score. I have not proved idempotence on real data; the
   arithmetic says it holds because the same inputs go in.

3. **The queue is bounded at 50 and does not paginate.** A company with more than fifty
   outstanding flags sees fifty. No notice is rendered. That bound is arbitrary and the silence
   about it is the defect I would fix first if this ever fills.

4. **`readReviewFlags` uses a PostgREST inner-join filter** (`pitch_scores!inner`) to scope by
   company. That is the right shape and it is one of the few places in this feature where the
   tenant boundary rides on a query modifier rather than on an explicit comparison. It is
   caller-scoped, so RLS is also carrying it — but if this read is ever moved to the service role,
   that join stops being a safety net and becomes the only thing.

## Not built, and said on the screen

- **"Schedule check-in"** on both Pattern Interrupt tabs — disabled, with its reason.
- Nothing else on the Coach Assessment board. The three other "Needs your attention" items are
  live: disputes render in full above via `DisputeQueue`, prize-eligibility comes from the
  assessment read, and "dissects didn't auto-generate" has its Generate missing action.

## The third time, and what it actually is

`reviewFlags` crashed six tests because I wrote `flags === null` for a field that can arrive
`undefined`. `events` and `comparison` did the same earlier today, and **I wrote the defence for
both of those**.

That is not a knowledge gap and it is worth being precise about what it is instead. The habit is
**shipping a read and its surface in one motion and treating the response shape as a fact**. At
the moment of writing, the field always exists — I just added it to the route. The case where it
does not is a client that loaded before the deploy, which is invisible from inside the edit.

Three instances in one session means the correction is not "remember harder". The candidates are:
a shared `wire<T>()` helper that makes every new field optional at the boundary by construction,
or a render test that mounts each board against the *previous* response shape. Both are real work
and neither is this build's scope; recorded so the next person does not diagnose it a fourth time.

## The shape worth remembering

This build needed no migration, no table, no endpoint and no new write path — and it closed a gap
that had been on screen for three builds. Everything it required already existed:
`flagsForReview` on the rubric item, `evidence` and `timestamp_s` on the event, the override RPC,
and a manager-gated route with a reason requirement at three levels.

**The gap was never missing capability. It was a field nobody read.** That is the same finding as
`pattern_events` this morning, one level down — a table with no writer, then a value with no
branch, now a field with no consumer — and all three were invisible to every audit in the repo
until someone opened the file and asked what used it.

The two audits built today gate the first two. The third has no gate, and I am not proposing one:
"every declared field is read somewhere" would fire on every optional property in the codebase.
What catches it is the question, asked while reading: *what consumes this?*

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build.

Two sources were opened at full resolution earlier today and are quoted: `Coach Assessment
manager dashboard (web).pdf` (the attention row) and `EloState AT&T Fiber Pitch Scoring Rubric.pdf`
p.6 (the violation and its escalation clause).

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser
— twentieth consecutive build shipped from jsdom.

---

# APPENDED 2026-09-22 — a wrong number in the file I had just shipped

This section is appended, not edited in (§3.1). The build above shipped; this is what re-reading
it found an hour later, while an unrelated `npm run check` was running and there was nothing to do
but look at my own work.

## The defect

```ts
// as shipped
deduction: rubric?.deduction ?? Math.abs(Number(r.points) || 0),
```

I had reasoned — and written in the comment above it — that the row should report what the RULE
costs rather than what the pitch was docked. The board's own wording settles it and I had quoted
that wording in this very document three sections earlier:

> Pitch on Thu 17 Sep, **−10 applied**. Confirm or remove.

*Applied.* A manager is confirming a deduction that has already landed on a real score, and the
number in front of them has to be that one. Removing it undoes exactly that much. If the card says
−6 and the pitch lost −2, the manager is answering a question about a pitch that does not exist.

```ts
// corrected
deduction: Math.abs(Number(r.points)) || rubric?.deduction || 0,
```

## Why nothing caught it, and why nothing could have

`viol.rude` is the only violation with `flagsForReview: true`, and it carries **no `maxTotal`**.
So the rubric's face value and the applied points are the same integer today, for every row in
production, and the two expressions are indistinguishable. There was no test to fail and no screen
to look wrong.

It becomes visible the day a second violation gains `flagsForReview` **and** a ceiling — which is
precisely the future this build was designed for, because §2.2 made the flagged set derived from
the rubric so a new one appears here *without anyone editing this file*. The design that makes the
queue extend itself is the design that would have shipped the wrong number to the extension.

## What actually failed

Not the reasoning — the **absence of a unit test on the read at all**. `readReviewFlags` shipped
with coverage only through `ReviewFlagQueue.render.test.tsx`, which tests the component against a
fixture I wrote by hand, from the same belief that produced the bug. A fixture and the code it
checks that come from one head at one sitting agree with each other by construction.

`src/lib/coach/assessment/__tests__/reviewFlags.test.ts` — 12 cases — now covers the read:

| Case | What it pins |
|---|---|
| capped violation | the applied points, **not** the rubric's face value |
| negative stored points | a sign flip upstream cannot print "−-10 applied" |
| zero points | the rubric is the fallback, and only then |
| derived set | `REVIEW_FLAG_IDS` equals the rubric's `flagsForReview` ids |
| non-empty set | an empty set silences this queue permanently |
| override present / on another item | reviewed means *this* (pitch, item), not that pitch |
| failed read | `null`, never `[]` — an empty attention queue reads as reassurance |
| untimed flag | `null` seconds, not `0`, which would open the clip at 0:00 |

**Probe.** Reverting the one line to the shipped version fails the capped case by name
(`expected 10 to be 4`), and eleven others still pass — the test is specific to the defect rather
than to the file.

**A bug in my own fixture, caught by the same run.** `timestamp_s: over.timestamp_s ?? 42`
overwrote an explicit `null` with the default, so the untimed case tested nothing. `??` treats the
value a test exists to exercise as an absent one. Changed to an `in` check.

## The gate change that came with it

`npm run check` failed on the harness from the previous build:

```
✗ Exported, and reached by no non-test file: src/test/previousShape.tsx
```

Correct as written, and a false positive in substance: `src/test/` is the shared-test-helper
directory, and being reached only by tests is its finished state, not its unfinished one.

The fix is **not** an allowlist entry. `isTest()` now counts `^src/test/`, which matters on the
side nobody would have checked: `isTest` gates both what is audited **and what counts as a
referrer**. Before this line, a helper under `src/test/` was a non-test file, so an orphan
imported only by a test harness read as *reached* — the audit's own failure mode, one indirection
out.

**Probe, both arms, run before and after:**

| | orphan imported only by the harness | `previousShape.tsx` |
|---|---|---|
| before the fix | **not flagged** — masked | flagged (the false positive) |
| after the fix | **flagged** | not flagged |

With the rule disabled, the self-test `a shared test helper is excluded` fires and the audit
declares its own result untrustworthy (`process.exit(3)`). The masking was measured, not assumed.
Anchored to `^src/test/` rather than any path segment called `test`, per A30: `/test/` anywhere
would quietly exempt a future `src/lib/<x>/test/` of real code.

## What this says about the session

Three of today's defects are now the same shape: a value that is *currently indistinguishable*
from the correct one. The wire fields crashed only against a response shape that does not exist
yet; this number is wrong only for a violation that does not exist yet. In both cases the code is
correct against today's data and wrong against the data the design explicitly invites.

The lesson is not "write more tests". It is that **the test I would have written from the same
sitting agrees with me**. What caught this was re-reading a file with nothing else to do, which is
not a process I can schedule.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this appendix.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser.

---

# APPENDED 2026-09-22 (second) — the queue that would have gone quiet at fifty

The appendix above ends with a residual I had named in the original closure as *"the defect I
would fix first if this ever fills"*. Looking at it properly, it is not a capacity limit. It is
the exact failure this feature was written to prevent, arriving through the limit clause.

## What it actually did

```ts
.order("id", { ascending: false })
.limit(50)                                  // ← the budget is spent HERE
…
.filter((r) => !reviewed.has(`${r.pitch_id}:${r.item_id}`))   // ← and these already spent it
```

The queue was not "the fifty oldest unreviewed flags". It was "whichever of fifty rows happen to
be unreviewed". Answer all fifty and the card renders **empty** — with unanswered flags still
sitting in the table, older than the page. The board then says, in as many words:

> No rude-or-dismissive flags awaiting review.

Which is the one sentence on this card that must never be false. The read was hardened against a
*failed* query returning `[]`; it was not hardened against a *successful* one returning `[]` for
the same reason.

## A second defect found while fixing the first

`.order("id", { ascending: false })` was written to mean "most recent". `pitch_score_events.id` is
`uuid primary key default gen_random_uuid()` — **the ordering was arbitrary**. The queue was not
showing the newest flags; it was showing an unpredictable fifty, stably enough that nothing looked
wrong. Now ordered by `recorded_at desc`, which is also what the card prints.

## The fix, and why not a bigger number

Raising 50 to 500 moves the cliff and makes the failure rarer — therefore harder to ever find
again. The limit has to apply to **unreviewed** rows, which means the anti-join must happen before
the cut, which means in the database. PostgREST cannot express `not exists` across two tables, so:
**view `unreviewed_violation_flags` (migration 0264)**, `security_invoker = true`, plus an index
on `(pitch_id, item_id, item_type)` for the lookup.

The view deliberately does **not** know which violations flag for review. That set is derived from
`rubric.ts` in TypeScript, and a second copy in SQL is the §2.2 drift this build was written to
avoid. The view holds the half SQL is better at — *has a human answered this* — and nothing else.

`count: "exact"` rides on the same request, so the page and the true total come from one query and
cannot disagree. The card now says **"Showing the 50 most recent of 137 flags awaiting review"**
instead of implying it is the whole set.

## Verification — run, not asserted

**The view, against real Postgres** (`migration_audit_scratch`, all 262 migrations applied, one
transaction, rolled back):

| Probe | Result |
|---|---|
| violation with a `removed` override | **excluded** |
| violation with no override | **present** |
| a `bonus` event | never appears (`type = 'violation'`) |
| a different item on the same pitch | **still present** — a review of one is not a review of all |
| an `element` override with the same item id | **not a review** — `item_type` is load-bearing |
| an `awarded` override (confirm) | **counts as reviewed**, 2 unreviewed → 1 |

```
select reloptions from pg_class where relname='unreviewed_violation_flags';
 {security_invoker=true}
```

`migration:audit` against real Postgres: 262 applied, 0 failed, 0 newly non-re-runnable.

**Mutation probes.** Rendering the count line unconditionally fails three of the four new render
tests by name. One mutant — dropping the `total > flags.length` guard — **survived and is
equivalent**: `more > 0` already decides whether the line appears. Rather than leave two
expressions deciding one thing (§2.2 in miniature), the guard was replaced with
`Math.max(0, total - flags.length)`.

**A test that would have caught the original defect** now exists and names it: the double records
which relations the read asks for, and asserts `pitch_score_overrides` is never among them. If
anyone reintroduces filter-after-the-cut, that assertion fails.

## Wire compatibility, on purpose

`reviewFlags` stays an **array**. The total ships as a **new field**, `reviewFlagsTotal`. Turning
the existing field into `{flags, total}` would hand a browser still holding this morning's bundle
an object where it expects an array — `flags.length` on an object being precisely the crash that
took three surfaces down today. An old client ignores a field it has never heard of and renders
exactly what it rendered yesterday.

## What I am NOT claiming

The view's behaviour is verified against a scratch database, not against production data, and the
TypeScript tests exercise a double of the view rather than the view itself. A change to the view's
`where` clause would not fail a single unit test. That gap is real and is the honest residual of
this fix; closing it needs a SQL-level test harness this repo does not have.

The count is exact **at read time**. A manager who leaves the board open while flags accumulate
sees a stale number until the next load, like every other figure on the page.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser.

## Appended the same day — what `security_invoker` means for the anti-join

Checked after the fact, because the question only surfaced while writing the next build's docs:
the view is `security_invoker`, so the `not exists` against `pitch_score_overrides` is evaluated
under the **caller's** RLS.

That creates a failure mode worth naming. If a caller could read the violation events but **not**
the overrides, every flag would come back unreviewed — forever. The queue would never drain, and
it would look like a queue nobody is answering rather than a permission problem.

It does not happen, and here is the policy that prevents it:

```
POLICY "pitch_score_overrides - select" FOR SELECT
  USING (EXISTS (SELECT 1 FROM pitch_scores p
                 WHERE p.id = pitch_score_overrides.pitch_id
                   AND p.company_id = auth_company_id()
                   AND (p.rep_id = auth.uid() OR is_sales_coach_manager())))
```

A manager reads every override in their company, which is exactly the set the anti-join needs.
Not a regression either way — the previous code read the same table with the same client, so a
blocked read would have produced the same empty `reviewed` set. Recorded because the consequence
changed: it used to be "the filter does nothing", and it is now "the view's WHERE clause does
nothing", which is harder to see from the TypeScript.
