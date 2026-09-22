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
