# BUILD — one authority, three callers, and a drain that says why it stopped

### The authority, so three callers cannot each invent the gate

- **write-path:** `scoreSession()` in `src/lib/coach/pitchScore/scoreSession.ts` — session read,
  kind check, optional already-scored skip, grading, store, detection — returning a `ScoreOutcome`.
- **read-path:** the existing 141 pitch-score route tests, which now exercise it through the route
  and pass unchanged; plus the backfill suite branching on every verdict.

The route used to hold the whole sequence inline, which was fine while it had one caller. It now
has three — the button, `/finalize`, and the drain — and three inline copies of "can this be
scored?" is the duplicated condition §2.2 exists to stop.

**It does not authenticate, deliberately.** Each caller owns its own auth story and passes the
client it already has; whatever that client can see is what gets scored. A `trustMe: true`
parameter would have been the weaker design.

**The refusal carries its own sentence.** My first pass returned a bare reason code and let the
route rebuild the wording from a static map — which silently dropped `(this is a huddle)` from the
message, because only the authority knows the session kind. Three tests failed and named it. That
is the clause's own failure mode, in miniature, inside the refactor meant to honour it.

The field is `humanMessage`, not `message`: INVARIANT 14 flags `error:` set to a `.message` at a
5xx, because that is the shape of a leaked exception. This string is curated and never an
exception's, but neither a reader nor the checker can tell that from `.message`. Renaming beat an
allowlist entry that future readers would have to take on trust.

### Scoring when the recording is finished

- **write-path:** the `scoreSession` call before the response in
  `src/app/api/coach/sales-session/[id]/finalize/route.ts`, with `pitchScored` on the body.
- **read-path:** the existing finalize suite, unchanged and passing — the hook is wrapped so it
  cannot change any outcome those tests assert.

`/finalize` already holds the authenticated caller, the company, the session and the transcript,
and is already where "this recording is done, derive things from it" happens. Hooking the other
close paths instead would have been three things to keep in step.

It **cannot fail the finalize.** A rep finishing a call must never see an error because a grader
was slow; the transcript and the five artifacts are saved and correct by that point. A failure logs
and the recording stays scoreable by the button and by the drain. `skipIfScored: true` because the
client retries `/finalize`, and a second grading would bill twice and write a second row every
per-session read would then have to disambiguate.

A huddle reaching here is ordinary and logs nothing. Anything else is a pitch that should have
scored and did not — which is the silence this build exists to end — and it logs with its reason.

### The drain

- **write-path:** `GET`/`POST /api/coach/sales-session/pitch-score/backfill`.
- **read-path:** 13 tests covering the count, the suppressed halt, the termination contract, the
  skip-if-scored guarantee, and both auth refusals.

**The count is free and comes first.** `GET` does two id-only reads and no LLM call, so a manager
sees *"142 recordings have never been scored"* before anything is spent. A failed read returns 500
rather than `{ unscored: 0 }` — reporting zero about a backlog nobody counted is the confident-zero
this whole feature exists to remove.

**Batched, though the decision was one pass.** A function dies at 300s; 142 gradings do not fit, and
an invocation that half-finishes and returns nothing is worse than one that never started. Each
POST grades `BATCH = 8` and reports what remains; the caller loops. Same contract the dissect
backfill already uses — *"returns how many remain, so the admin runs it until remaining = 0"* — and
from the manager's side it is still one action.

**It terminates without a new column.** There is no `score_attempted_at`, so a recording with no rep
speech stays a candidate forever and "loop until `remaining` is 0" never stops. The contract is
therefore `more`, not `remaining`: a pass that scored nothing new has hit the floor, and what is
left is reported by reason instead of retried. `no_agent_turns` is decided before any LLM call
(`generatePitchScore.ts:95`), so the re-checks that do happen cost nothing.

**`suppressed` stops the whole run.** Guidance being off is an account state (§3.4 month 1 is a
control condition), not a property of one recording — so every remaining session would refuse
identically. Continuing would turn one answerable message into eight, and on a large backlog would
walk an entire history to learn what the first session already proved.

**Manager-gated, not owner-gated.** This spends money across a company's whole history, so the
owner-or-manager rule that governs scoring one of your own recordings is not the right gate.

**A set difference in memory, not a PostgREST anti-join.** `not.in.(…)` would put every scored id
in the URL. Both reads page to completion through `fetchAllPaged`, which throws rather than
returning a short page — a truncated candidate list would under-report the backlog, and the entire
value of showing the count first is that the number is trustworthy.
