# CHECK - no recording with speech in it is left without a transcript

### F1 - a test asserted the defect, which is why nothing ever tried
class: the-expectation-was-the-bug
sweep: every precondition in the two recovery routes, against the four transcript states that can exist
severity: high
`not-applicable (200) when there is no transcript / no agent turns` was a deliberate, commented test that
had never once failed. It pinned the behaviour that left nine production sessions unrecoverable for up to six weeks. The
refusal was not an oversight anyone would find by reading the code - the code was doing exactly what its
test said it should. Rewritten to `RECOVERS a blank transcript - a call with audio and no words is
exactly the case to fix`, with the production numbers in the comment so the next reader cannot re-derive
the old expectation from first principles.

### F2 - my own measurement reported a confident zero from the wrong table
class: measured-the-neighbouring-table
sweep: the bucketing script re-run against `coaching_transcript_segments`, the name taken from `getSessionTranscript` rather than recalled
severity: medium
The first bucketing run queried `sales_session_transcript`, which does not exist. PostgREST returned an
error object, the script pushed nothing, and the summary printed `transcript segments total 0` alongside
`audio + NO transcript 16` - a clean, plausible, entirely wrong table. It was only caught because the
error line was printed above the numbers. Corrected run: 2,268 segments, and the dropped count is NINE,
not sixteen and not the thirteen an earlier estimate had carried. Every number in think.md is from the
corrected run. The lesson is the one A36 keeps paying out: a result that agrees with what you expected is
the one to check hardest.

### F3 - my refactor silently collapsed two HTTP codes the route separated on purpose
class: a-refactor-that-flattened-a-distinction-it-did-not-notice
sweep: every failure return in the extracted resolver, against the route test's pinned codes
severity: medium
Moving the route body into a library, I mapped failures as `transient ? 502 : 422`. The original
distinguished 502 (storage / speech-to-text - an upstream outage worth retrying) from 500 (our own
database write). The existing route test caught it: `expected 502 to be 500`. The test was right and I
was wrong. The result type now carries `where: "upstream" | "internal" | "invalid"` so the distinction
survives the extraction instead of being re-derived from a boolean that cannot express it.

### F4 - answering the question would have destroyed the timing the recovery had just created
class: the-fix-for-one-half-breaking-the-other-half
sweep: every writer of `spoken_at` on the recovery-then-label path
severity: high
`/label-transcript` rebuilds `spoken_at` from the `startSeconds` in the payload it is sent. The stored
transcript carries `spoken_at` but no offsets, so the obvious app payload - text and seq - would have
stamped every segment NULL. The rep's single tap would have made the transcript coachable and silently
deleted the timing that makes the pace skill work, in the same request. `startSecondsFor` reads the
offsets back out of `spoken_at` against the session start. Pinned by
`the offset is read back out of spoken_at, so answering keeps the timing`.

### F5 - a placeholder shipped unsubstituted into the PREVIOUS build's own record
class: the-record-was-not-read-after-it-was-written
sweep: `%(` across docs/tbc
severity: low
The daily-goal build's closure.md reads `"opened_at": "%(NOW)s"` - a Python format placeholder that my
edit script never substituted, committed in `3def4771` and printed back verbatim by `tbc:residual` every
run since. Nothing failed; the gate has no concept of a placeholder that parses as a string. Recorded
here and corrected in remediate.

### F6 - the sweep I had just written was an unbounded cost loop
class: a-guard-that-was-right-for-a-human-and-wrong-for-a-machine
sweep: every `releaseMarker()` call site, re-read against an unattended caller instead of a rep pressing a button
severity: high
Found by opening R4, the residual I had marked "high confidence it does not matter". The original route
releases the at-most-once marker on a TRANSIENT failure so a momentary outage does not permanently burn a
session's one recovery attempt. That is correct under a rep pressing a button. Under an HOURLY sweep it is
a different mechanism entirely: a recording that can NEVER be transcribed fails, releases, and is picked up
again next hour, forever, spending a speech-to-text charge every time and never finishing.

It is not hypothetical, and the measurement is why R4 was worth opening. Three of the nine dropped sessions
are 39-43 MB against 619 KB for a known 149-second call - hours of audio, and precisely the files most
likely to exceed the 300-second function budget. **The one case with the most to recover is the one that
would have looped.** Bounded by `MAX_TRANSIENT_RETRIES = 3`, tallied in an append-only event so the budget
survives a restart, and failing CLOSED when the tally cannot be read.

### F8 - the sweep would have argued with the person it asked
class: the-automation-overwriting-the-human-answer-it-solicited
sweep: every transcript shape a REP can produce through the picker, not only the shapes the system writes
severity: high
Found by walking what a rep actually does with the new picker rather than by a test. When they answer
"that was the customer, not me" - the one-sided capture the picker exists for - every segment is labelled
`customer`. `isRecoverable` said "zero agent turns means recoverable" and `mayOverwriteUnlabelled` said
"zero agent turns means safe to overwrite", so the next sweep would have replaced their deliberate answer
with `unknown` within the hour. The system would have asked a question, been answered, and then overruled
the answer on a timer.

A customer-only transcript with no unknowns can ONLY be a human answer: recovery writes all-`unknown` or
agent-plus-customer, live capture writes agent turns. Agent-only is not symmetric and stays recoverable -
that is the original customer-missing gap.

FIXING IT PRODUCED THE OPPOSITE ERROR, and the existing suite caught that too. My first attempt returned
early on "any unknown turn", which would have let the sweep re-read a perfectly good TWO-SIDED call:
`/segments` accepts `unknown` per turn, so a live-coached transcript can hold agent, customer and unknown
together. `refuses a two-sided transcript even when unknown turns are mixed in` failed immediately. The
two-sided check now runs first.

### F9 - the sweep ran ahead of the migration, in production, today
class: a-race-i-described-in-my-own-record-and-then-lost
sweep: the production migration ledger against the first live sweep run
severity: high
think.md's Ripple section named this exact risk - "a deploy-before-migrate loses the timing" - and then it
happened at 17:20 while the founder was still being handed the command to apply 0249. The sweep recovered
a 42-minute call as 106 correctly attributed segments with every `spoken_at` null, and F7's read-back
guard logged `coach.transcript_recovery_timing_lost` naming it. The guard worked; the race was still lost.
Because the at-most-once marker is now set, recovering that timing means clearing markers and paying for
transcription a second time.

Writing a risk down is not mitigating it. The UNATTENDED sweep now reads the migration ledger and does
nothing until 0249 is applied, returning `waitingForMigration` so an empty run can never be read as
"nothing needed doing". An unreadable ledger also declines - spending money on an irreversible write while
unsure is worse than waiting an hour. The on-open path is untouched: a rep triggering recovery is a human
choosing to have their words back now.

### F10 - the web offered to re-transcribe words it already had
class: an-affordance-that-outlived-the-problem-it-solved
sweep: every path a rep can reach an unattributed transcript from, web and phone
severity: medium
The After-Pitch recovery card predates this build and was correct when written: a blank read meant the
words were genuinely missing, so re-transcribing was the only cure. Recovery changed that premise without
changing the card. For a recovered `unknown` transcript it would have charged a second full transcription
of a 42-minute recording to recover words already in the database, under copy asserting the read "came
back blank" - which was no longer true. Replaced with the direct question. The card is unchanged for every
case where the words really are missing.

Also caught by reading rather than by any gate: `{answering ? "Saving…" : "That&apos;s me"}` puts an HTML
entity inside a JAVASCRIPT string, where nothing decodes it - the button would have rendered the literal
characters `That&apos;s me`. Typecheck and lint both pass on it. Only looking at it finds it.

### F11 - I cited a constitutional asset I had not opened, and it did not say what I assumed
class: the-citation-that-travels-faster-than-the-reading
sweep: `A18` across the coach routes; then A18 itself, opened
severity: medium
The routes this build sits beside attribute the owner-only transcript rule to "A18", and I copied that into
a new route without opening it. A18 is about the LABEL on human-behaviour data surfaced to a leader - that
"Warning" invites enforcement where "Needs Guidance" invites mentorship - and says nothing whatever about
who may write a transcript. The RULE is real and load-bearing (the service role bypasses RLS, so the
ownership check is the only thing between a colleague and another rep's canonical transcript); the citation
was decoration, and it was wrong.

This is A22's exact mechanic, caught only because the commit hook demanded a Session-Reads timestamp and I
had to open the asset to supply one. The new route states the reason in plain words instead. The
pre-existing miscitations in the neighbouring routes are left alone - rewriting other builds' comments is
not this build's business - but they are recorded here so the next reader knows they are decoration.

### F12 - the same class again, one layer up: the coaching engines report a timeout as silence
class: a-failure-that-is-indistinguishable-from-a-legitimate-absence
sweep: every early `return null` in the nine coach engines, then artifact coverage across all 168 sessions holding a readable transcript, bucketed by transcript length
severity: high
Found by sweeping the class this whole build is about (A26) rather than by looking for a new bug. The
transcript failure was "produced nothing, said nothing". `withEngineTimeout` is the same thing one layer
up: on timeout it RESOLVES to the engine's empty fallback. It does not reject, and it recorded nothing - so
an engine that ran out of time and an engine with genuinely nothing to say produced identical results, and
the difference is the whole question a rep asks when a call comes back uncoached. The file even called that
fallback "honest", which it is not.

MEASURED, because "engines sometimes time out" is a guess and this is not. Across the 168 sessions holding
a transcript any engine can read (they all filter on `speaker === "agent"`):

    words in transcript   sessions   summary   dissect   pivot   moments
    0-50                        15       93%       93%     93%       87%
    50-200                      20      100%       95%     85%       75%
    200-600                     63       78%       63%     52%       29%
    600-2000                    65       78%       57%     57%       32%
    2000+                        5      100%       20%     60%       20%

That is BACKWARDS from any "no signal" explanation - a 600-word sales conversation has more to analyse
than a 50-word one, not less. Coverage collapses as the transcript grows, which is the shape a per-call
time bound makes from the outside. The 200-600 and 600-2000 buckets are 63 and 65 sessions, so this is a
sampled result, not an anecdote. The 2000+ row is FIVE sessions and is reported as suggestive only.

The consequence in plain terms: the longest, most valuable calls are the least likely to be coached, and
nothing anywhere said so.

SWEPT TO THE BOUNDARY, not fixed at one site (A26). `withEngineTimeout` has two callers -
`generateSessionArtifacts` (5 engines, the upload + recovery path) and the `summarize` route (4 engines, the
web on-demand + auto-heal path). Both were blind in exactly the same way and both now take the note. Fixing
only the one where the measurement was taken would have left the class alive in the path a rep reaches by
opening a call.

NOT FIXED HERE, and deliberately: the bound was left at 40s. Whether to raise it trades latency and LLM
cost against coverage, and that is the founder's decision, not this file's. What changed is that a timeout
now REPORTS itself - `coach.engines_timed_out` names the engines and the transcript size that beat them -
so the decision can be made from a measured rate instead of from this one-off probe. Also noted: the loser
of a `Promise.race` is not cancelled, so a timed-out engine may still persist its own result later or may
be killed when the function freezes, and which of those happened was never recorded either.

### F13 - a failed lookup could have silently stopped the weekly team brief for every company
class: a-failure-that-is-indistinguishable-from-a-legitimate-absence
sweep: every `.catch(() => <value>)` in src/lib/coach, opened rather than counted
severity: medium
The same sweep, one more instance, and this one had the widest blast radius for its size.
`runTeamBriefPregeneration` chooses which companies get a brief by querying the events table, and caught
that query into `[]`. A transient database error therefore produced zero companies, zero briefs, and a
cheerful `{ ok: true, companies: 0, generated: 0 }` from the cron route - which is EXACTLY what a genuinely
quiet week produces. The weekly brief could stop for every company on the platform and the only symptom
would be a success response with two zeroes in it, once a week, seen by nobody.

The empty fallback is KEPT - one bad query must not throw away a whole run - but the run now says which
zero it is, and the cron route returns 500 rather than ok when the lookup failed.

WHAT THE SWEEP DID NOT FIND, which matters as much: the `.catch` calls in `dissectBackfill` look identical
to a grep and are NOT the same thing. They are per-session inside a batch, annotated with why, and the run
reports counts either way - a considered decision that one session must not stop the batch. Opened rather
than counted, per the standing rule that a grep result is a list of suspects.

### F14 - the website printed the raw database column at a rep, and my own fix made it visible
class: an-internal-state-word-reaching-a-human-screen
sweep: every place a transcript speaker is rendered, web and phone
severity: medium
The session page rendered `{seg.speaker}` directly, uppercased by CSS - so a transcript read `AGENT` and
`CUSTOMER`. Harmless-looking until today, when recovery began saving a dropped call's words BEFORE anyone
had attributed them: those two sessions now read **`UNKNOWN`** above every single line, live, on the screen
the founder would open to answer the voice question.

`unknown` is an honest internal state. Printed at a rep it reads as a verdict on their call, or as an
error - the same absence-presented-as-measurement failure this build spent all day removing. The PHONE
already got this right and says "Unattributed"; the website was showing the column.

DELIBERATELY NOT "You", which is what the phone says. The phone is in the rep's hand. This page has no idea
who is looking - a manager can open a rep's call - so "You" would be a claim it cannot support. "Rep" is
true for every viewer, and the one-noun divergence is the honest trade.

NOT reusing `speakerLabel` from coach/strategy/renderTurns.ts, which exists and looks applicable. That one
renders speakers INTO AN LLM PROMPT for multi-party meetings: the audience is a model, the speaker is a
participant name rather than a role, and shouting UNKNOWN is the correct signal there. Reusing it would have
put prompt vocabulary on a rep's screen.

MY OWN TEST WAS WRONG FIRST, and rightly failed. I asserted the output never equals the column value -
false, because "customer" is a perfectly good English word and "Customer" is its correct label. The real
property is narrower: values that mean something only inside the system must never reach the screen.

### F15 - the KPI drill-down printed snake_case at the reader checking whether to trust the number
class: an-internal-state-word-reaching-a-human-screen
sweep: every `{x.speaker}`, `{x.outcome}` and `{x.status}` rendered in a .tsx, opened rather than counted
severity: medium
Swept from F14, and it found the same leak somewhere it costs more. The KPI page's source-session list -
the DRILL-DOWN that justifies a metric, which is the one place a reader looks when deciding whether to
believe it - rendered `s.outcome` raw. So the evidence for a conversion rate read `no_sale`, `follow_up`,
`no_contact`. A snake_case identifier on the evidence for a number undermines the number.

`outcomeLabel` already existed for exactly this, and its own header says why: "one source instead of four
copies", client-safe so pages can import it. The page simply was not using it. The fix is an import.

TWO OF THE THREE SUSPECTS WERE NOT DEFECTS, and opening them is the reason I can say so.
`sessions/page.tsx` renders `s.status` - but `active`, `ended` and `reviewed` are ordinary English words, not
internal identifiers, and inventing a label module for them would be churn. `admin/monitoring` renders
`seg.speaker` raw - and should: it is an internal diagnostic view where an admin debugging attribution wants
the actual column value, and `unknown` there is informative rather than alarming. A grep result is a list of
suspects.

### F16 - my own sweep would have starved a tenant, silently and forever
class: a-fair-looking-order-that-serves-one-queue
sweep: the sweep's candidate ordering, read against a SECOND company rather than the one I measured
severity: medium
The sweep takes candidates OLDEST FIRST and stops at a per-run cap. Oldest-first is right and load-bearing -
`recording-purge-cron` keeps only each rep's 20 most recent recordings, so the oldest dropped calls are the
ones closest to losing their audio permanently.

Applied across ALL companies at once it has a failure mode that never announces itself. One tenant sitting
on a large backlog of old dropped calls fills every run, forever; a second company's dropped calls are never
reached, and their audio ages toward the same purge. Nothing errors. The sweep reports a healthy `recovered`
count every hour and the starved tenant simply never appears in it - the same shape as every other finding
in this build: a failure indistinguishable from ordinary operation.

Not distant for this system: today's dropped sessions span THREE account prefixes and the permanently-failed
pitches span TWO companies. Companies now take turns, oldest-first within each. Deliberately not a weighting
or a quota - those need a tuned number somebody has to maintain, and taking turns needs none.

### F17 - a NUL byte in my own source file, found by a mutation that would not apply
class: an-invisible-character-that-every-tool-tolerated
sweep: `\x00` across every file written today
severity: low
Three attempts to mutate one line of `sweepFairness.ts` reported "line not found" while the line was plainly
there. The line held `"\x00no-company"` - a NUL byte where I had written a space. `grep` had been calling the
file BINARY and I had read that as noise.

It broke nothing: any string serves as a map key, so the logic was correct and every gate passed - typecheck,
lint, tests. That is the point. An invisible control character in shipped source is the kind of defect that
survives indefinitely because nothing complains, and it makes the file opaque to exactly the tools someone
would reach for when debugging it later. Replaced with `"__no-company__"`, and every other file written today
swept and confirmed clean.

The mutation that "failed" was the finding. A tool refusing to do something simple is worth one minute of
attention before being dismissed.

### F18 - I told the founder a cause I had inferred, and the measurement says it is probably the OTHER one
class: a-hypothesis-reported-in-the-register-of-a-finding
sweep: `coach.dissect_attempted` reasons and transcript sizes across all 168 readable sessions
severity: medium
F12 reported that coaching coverage collapses as transcripts grow, and said it "is the shape a per-call time
bound makes". The collapse is real and measured. The CAUSE was an inference, and I wrote it as though it
were the finding - including in the commit message and on the founder's board.

Chasing it properly changed the picture twice.

FIRST, my count of "missing dissects" was wrong. I counted sessions with no `dissect_generated` event, which
conflates NEVER TRIED with TRIED AND HONESTLY DECLINED. Separating them: **0 never tried, 56 attempted and
declined.** The backfill is working exactly as designed - it already carries a 14-day backoff marker so a
session that produces no signal is not re-billed every run, added on 2026-08-14 for precisely this.

SECOND, and this is the part that matters: those 56 are systematically the LONGER calls - **median 683 words
against 362** for the ones that succeeded, mean 809 against 540. Thin content would be SHORT. So "no signal"
is the wrong story for most of them, and the collapse is real.

But TWO causes leave that same trace and need OPPOSITE fixes:
  - a wall-clock TIMEOUT, fixed by raising the bound;
  - TOKEN STARVATION, which `salesDissect.ts` records costing two weeks of blank reads in the 2026-07-30
    outage - a reasoning model spending its whole budget before writing content - which a longer transcript
    makes WORSE and which more time does not fix at all.

I named the first. The length correlation fits the second at least as well, and the file's own header says
the second has happened here before. **Raising the timeout could have been the wrong fix, chosen from my
sentence rather than from data.**

The instrument now separates them: `coach.dissect_attempted` carries `transcriptWords` and `agentTurns`
beside the existing `reason`, so the correlation is a database query rather than a serverless log nobody
reads - which is exactly why this has been invisible. `reason` itself is untouched, because the sessions-list
UI reads that vocabulary.

### F19 - four of the five coaching engines vanish silently when they produce nothing
class: a-failure-that-is-indistinguishable-from-a-legitimate-absence
sweep: event writes in all five engine modules, counted then opened
severity: medium
`salesDissect` records its own declines - a `coach.dissect_attempted` marker, so the backfill backs off
rather than re-billing a stuck session. It is the only one that does. A summary, pivot, intel or moments run
that comes back empty writes NO event at all, so afterwards "the engine never ran" and "the engine ran and
found nothing" are indistinguishable.

That is not academic: measured across the 168 sessions the engines can read, coverage is summary 83%, intel
70%, pivot 62% and MOMENTS 40% - and for none of that missing 60% could anyone say which of the two it was.
It is the same class as the transcript failure this whole build is about, and F12, and F13: a path that
produces nothing while nothing says so.

Recorded at `generateSessionArtifacts` rather than inside four engines, because that layer already holds all
five results AND the transcript they were given - one change instead of four, at the only place that can see
the whole set. One event per session at most, and only when something actually came back empty.

It deliberately does NOT re-record a timeout. An engine the bound abandoned is already named in
`coach.engines_timed_out`, and counting it twice would make the empty count look worse than it is - which
would be the same overstatement F18 is a correction for.

### F20 - I reported a FIXED defect as a live one, and made it the headline
class: a-historical-failure-reported-in-the-present-tense
sweep: pitch failures either side of the founder's own 2026-08-27 iOS fix
severity: high (as a reporting failure; the underlying defect is closed)
F-the-five-byte-recording said "14 of 83 door pitches failed permanently - 17%" and framed it as something
happening now. It is true of the whole table and FALSE as a present-tense statement:

    BEFORE the 27 August iOS fix ....... 14 failed of 66   (21%)
    SINCE  the 27 August fix ...........  0 failed of 17

The founder found and fixed this on 2026-08-27 from field telemetry, and the fix is documented in
`useDoorRecorder.ts`: *"iOS Safari 18.x now FALSELY reports audio/webm as supported... DoorLog captures were
iOS recording as audio/webm;codecs=opus (sawData=true, TINY BLOB, chunksUploaded=0)"*. That is the five-byte
file exactly. The container preference list now puts `audio/mp4` first on iOS, and not one pitch has failed
since.

I had the evidence and did not read it. The failed rows were all dated 20-25 August, the fix 27 August, and
the gap between those dates was the whole story. I ran the query that proves it only after noticing the app
records `m4a` while the failures were `webm` - which should have been the FIRST question, not the last.

WHAT SURVIVES, stated separately so the correction does not throw away the real part:
  - the four recoverable pitches still hold ~34 MB of real audio, and that decision stands;
  - the integrity guard is still worth having - it catches an empty recording AT THE DOOR, where the rep can
    re-record, rather than in a `pitches` row five retries later that nobody reads. That value does not
    depend on the cause being live, and it covers the APP path, which the web fix does not.

The lesson is the one this build keeps re-learning from the other side: I check whether a claim is stale
before believing someone else's; I did not check my own. A finding with dates in it should always be asked
"and what happened after the last one?".

### F21 - I tested my own assumption against the data and it was false
class: a-premise-asserted-as-a-fact-inside-a-guard
sweep: every customer-only transcript in production, against the dates the answer flow shipped
severity: medium (the reasoning; the behaviour is safe today)
F8 added a rule refusing to recover a customer-only transcript, on the stated ground that "nothing else
produces this shape - customer-only can ONLY be a human answer". I wrote that as a fact. It is false.

Production holds **six** customer-only transcripts dated 23 July to 18 August - all predating the answer
flow, which shipped today. They come from live capture attributing the customer and never attributing the
rep, which is exactly what the dissect's `no_agent_turns` decline counts. So the rule also refuses a genuine
capture gap.

THE BEHAVIOUR IS STILL RIGHT, and that is a different claim from the one I made:
  - all six carry NO saved audio, and the sweep only ever considers sessions that have some, so it cannot
    reach them regardless of this rule;
  - if such a session ever did have audio, `mayOverwriteUnlabelled` already refuses to replace it with an
    unlabelled re-read - the rep's answer is protected by that guard, not by this one.

WHAT I DID NOT DO, deliberately: change the behaviour. The set is empty, the trade is genuinely ambiguous,
and "I guessed at a rule from my own reasoning" is how this defect got here. `source` would settle it -
`manual` marks a human answer - but the older label path writes none, so marking every answer needs a
migration. Recorded as a known limit instead: skipping a re-read is a smaller mistake than overwriting an
answer somebody gave.

The test name was overstating in exactly the same way ("that is the rep's ANSWER, not a gap") and now names
the cost.

### F22 - the session route read anonymously, and the audit does not flag it
class: a-scoped-client-resolved-and-then-not-passed-on
sweep: every endpoint the app calls, probed against production with a real Bearer token before deploying
severity: high
`GET /api/coach/sales-session/[id]` resolves a Bearer-scoped client for AUTH and then calls `getSession` and
`getSessionTranscript` **with no client at all** - so those read through the default cookie client. A phone
sends no cookie, so the read runs ANONYMOUSLY, RLS returns nothing, and the route answers 404 "not found or
not accessible" for a session the caller owns. Verified: the founder's own session 404ed with the founder's
own token.

THE AUDIT DOES NOT FLAG THIS, and that is the part worth keeping. INVARIANT 26 looks for a BARE cookie
client in a route that never mentions `callerScopedDb`. This route mentions it, uses it for auth, and still
reads anonymously - so the check passes while the route is broken for every mobile caller. A30 exactly: an
audit cannot detect the class it has no concept of, and a clean gate is a statement about the gate's
vocabulary, never about the system.

### F23 - a typo in a URL returned 500
class: a-server-error-where-an-honest-not-found-belongs
sweep: malformed vs well-formed ids against the same live route
severity: low
`/sales-session/not-a-uuid` reached Postgres as a uuid comparison, the driver rejected it, `getSession`
rethrew - correctly, it must never collapse a transient error into a silent null - and the caller got a 500.
Measured: `not-a-uuid` and `zzzz` both 500; a well-formed but absent id correctly 404s. A 500 says "we
broke"; a typo in a URL is the caller's. Shape-checked only - existence and permission stay with RLS.

BOTH WERE FOUND BY PROBING, NOT READING, and the probe needs its own caveat: of five non-200 results, TWO
were paths I had invented and a THIRD was a web-only route the app never calls. A probe result is a list of
suspects, and opening them is the only reason the two real ones can be stated as findings.

### F24 - the class swept to its boundary: a rep's own scores were withheld from them
class: a-scoped-client-resolved-and-then-not-passed-on
sweep: every route mentioning `callerScopedDb` that then calls a data helper with no client argument
severity: high
F22 fixed one route. Sweeping the SHAPE rather than stopping at the instance found three more call sites
across two routes - and one of them is worse than the 404 that started this.

`GET /api/coach/sales-session/[id]/after-pitch` returns **200** with `{"summary":null,"isOwner":false}` for
the founder's OWN sessions, using the founder's OWN token. Measured against production, three sessions, all
three the same. `isOwner:false` is not a subtle wrong: the app withholds banked points and scores from a
manager viewing somebody else's call, so a rep on their own phone was being shown their own call as though
it belonged to someone else.

It returns 200, so nothing anywhere errors. That is the same disease as every other finding in this build -
the failure is indistinguishable from an honest empty answer.

THE INSTANCE WAS NOT THE BOUNDARY. `segments` POST had it too; `segments` GET does NOT, because it reads
`.from("coaching_transcript_segments")` with the scoped client directly - which is exactly why that endpoint
returned 200 with real data in the probe and looked fine. Three of the four sites in these files were
broken and the fourth was correct, so the file could not be judged as a whole.

WHY THE AUDIT CANNOT SEE ANY OF IT, worth writing down rather than filing as bad luck: INVARIANT 26 looks
for a route that never mentions `callerScopedDb`. All three of these mention it, use it for auth, and read
anonymously anyway. A30's sentence exactly - a clean gate is a statement about the gate's vocabulary, never
about the system. I am NOT extending the audit here: that is the founder's call about their own gate, and
this build has already spent its budget for changes made on my own judgement.

## Mutation testing (A30 - a guard nobody can break is not a guard)
Each guard was broken in source and the NAMED test watched to fail, then the source restored and confirmed
byte-identical with `diff`.

    M1  blank is NOT recoverable          -> x accepts a BLANK transcript - the nine-session production failure
    M2  canonical guard removed           -> x REFUSES a two-sided transcript - canonical speech is never clobbered
    M3  an unassigned cluster -> "agent"  -> x labels UNKNOWN when no cluster was assigned
    M4  a decline may overwrite anything  -> x REFUSES to overwrite real agent speech with an unlabelled re-read
    MA  an unknown time becomes zero      -> x an unknown time is never a zero
    MB  an empty transcript is askable    -> x an EMPTY transcript is not asked about
    MC  a negative offset is accepted     -> x a NEGATIVE offset is corrupt, not "slightly before the start"
    M5  a rep's customer-only answer is recoverable -> x REFUSES a customer-only transcript - that is the ANSWER
    M6  the two-sided guard weakened       -> x refuses a two-sided transcript even with unknown turns mixed in
    M7  a customer-only answer may be overwritten   -> x REFUSES to overwrite a rep's customer-only answer
    N1  attributed speech may be rewritten -> x 409s a transcript that already says who spoke
    N2  the unknown-only update scope dropped       -> x scopes the update to speaker=unknown
    N3  a missing answer defaults to "it was me"    -> x REFUSES to guess when the answer is missing
    N4  any colleague may answer           -> x 403s a colleague - only the session's own rep may answer
    P1  the timeout stops reporting itself -> x REPORTS the timeout, so an abandoned engine is not filed as quiet
    P2  onTimeout fires even on success    -> x 5 of 6 tests in the file
    P3  the note's throw may escape        -> x a note that throws never becomes the failure it was recording
    R1  the lookup failure stops being recorded     -> x says the lookup FAILED, so an outage is not a quiet week
    R2  every run claims a failure         -> x a genuinely quiet week reports zero WITHOUT claiming a failure
    T1  the raw column is printed again    -> x 3 tests, including "never prints an INTERNAL state word at a rep"
    T2  agent labelled "You"               -> x says Rep rather than You, because this page does not know who is looking
    T3  isUnattributed calls unknown attributed -> x is true only when nobody has said whose voice it is
    U1  no interleaving (starvation restored)    -> x STOPS one company's backlog filling the whole run
    U2  a no-company candidate is dropped        -> x a candidate with NO company is served in turn
    U3  rotation sorted instead of first-seen    -> x a company's place in the rotation is set by its OLDEST call

    MD  the null-count guard flipped to && -> SURVIVED, and it is recorded rather than quietly dropped.
        `null <= 0` is true in JavaScript, so a null count already falls out at the next guard; no input
        distinguishes the two spellings, so NO test can prove that line. It stays as documentation and now
        says so in its own comment, to stop a future reader believing a test is holding it.

## Gates
A38 first, because it applies to me here and the honest answer is not the flattering one.

**THE CANONICAL GATE DOES NOT EXIT 0 ON THIS MACHINE, and I am reporting that rather than the
subset that looked better.**

    npm run check exit: 1     (run twice)
      run 1:  Test Files 626 passed | 1 skipped (627) · Tests 4159 passed | 15 skipped · Errors 10 errors
      run 2:  Test Files   1 failed | 625 passed | 1 skipped (627) · Tests 1 failed | 4138 passed · Errors 10 errors

The 10 errors are `[vitest-pool]: Timeout starting forks runner` — the worker pool failing to start
under load, not an assertion. Run 2's single failure is
`src/app/api/schedule/timeoff > returns the derived time off with the staff member's name`,
`Error: Test timed out in 5000ms`. Three things say it is the machine and not this build:

  - the file is `src/app/api/schedule/timeoff` and has nothing to do with transcripts;
  - the outcome CHANGED between two consecutive runs of the same tree (0 failures, then 1);
  - run in isolation it passes — `npx vitest run src/app/api/schedule/timeoff/__tests__/route.test.ts`
    -> `Test Files 1 passed (1) · Tests 6 passed (6) · isolated exit: 0`.

That is evidence, not proof. **`npm run check` has not been observed exiting 0 for this build, and no
sentence here should be read as saying it has.** It needs re-running on CI or a quieter machine before
this is called shipped.

The individual commands, each run to completion with its own exit code:

    npx tsc --noEmit                      tsc exit: 0
    npx vitest run (the two changed suites, 30 tests)   vitest exit: 0
    npm run lint                          no output, exit 0
    npm run invariant:audit               Violations: 0  (1016 files, 38 documented exceptions)
    npm run rls:audit                     Tables without RLS: 0 · Tenant-pin risks: 0
    npm run test                          Test Files 636 passed | 1 skipped · Tests 4213 passed | 15 skipped
    node tools/gate.mjs (app)             G1-G4 PASS · G5 NOT RUN
    npm test (app)                        pass 1239 · fail 0

Two invariants in the audit apply directly to the new cron and reported 0 violations on it: *every cron
route registered in vercel.json (no silently-dead cron)* and *every LLM/transcription route exports
maxDuration (no prod timeout)*.

## VERIFIED IN PRODUCTION - the sweep ran and the recovered transcript is usable
This section replaces the "not verified yet" note that stood here until 17:20, because leaving it would
have been a stale claim outliving its cause.

The first sweep fired at 17:20 and attempted six sessions. Measured before and after:

    transcript segments ............ 2268  ->  2414   (+146)
    audio + NO transcript ..........    9  ->     6
    audio + unknown-only ...........    0  ->     2
    audio + two-sided ..............    6  ->     7

Session `76f8ae8b` - the 42.9 MB recording from 27 August that had held zero words since - came back as
**106 segments, auto-attributed agent/customer with no rep tap**, and `audio_duration_seconds` was stamped
at 2560 (42.7 minutes) from the transcription's own word timestamps. Its opening lines read as a real
conversation, not a diarizer artifact.

THE SECOND HALF OF THE FOUNDER'S INSTRUCTION, which is the part that could not be proven in test: every
existing coaching feature consumed it, within 40 seconds, unprompted:

    09:21:13  coach.session_intel_generated
    09:21:14  coach.session_moments_generated
    09:21:24  coach.session_pivot_generated
    09:21:24  coach.session_summary_generated
    09:21:41  coach.dissect_generated

The stored summary is a structured, accurate meeting record - attendees, agenda, logistics, requests.
`salesSummary` only writes its event when the generated text is non-empty, so the event's existence is
already evidence, but it was opened and read rather than inferred.

Two of the six wrote nothing and were right to: 9 KB and 60 KB files with no speech in them. Silence is
not a dropped transcript.

## What is STILL not verified
- Every recovered `spoken_at` is null, because 0249 is not applied - F9, and the sweep is now gated on it.
- No dropped session has been recovered WITH its timing intact. That needs the migration first.
- G5, the real-device runtime audit, has never been run on this app. Nobody has seen the picker, the
  "Needs your voice" chip, or the new deal-value Save button render on a phone.

### F25 - 28 door pitches were graded on a recording with nobody talking in it
class: a-guard-that-tested-for-empty-when-the-failure-mode-is-annotated
sweep: `pitch_transcripts` stripped of every `[bracketed]` / `(parenthesised)` sound event, across all 73 rows
severity: high
The worker has refused to analyze an empty transcript since audit H1 (founder 2026-08-22), for exactly the
right reason, written in the comment: the rubric schema forces a non-empty summary + scores, so analyzing
nothing produces a hollow "complete" pitch with made-up scores. The guard is `if (!text.trim())`.

STT does not return an empty string for a silent recording. It returns the sound it heard, annotated.
Measured 2026-09-10 against production: 28 of 73 stored transcripts are one bracketed sound event and not
one word of speech - `[clicking]` x8, `[pause]` x6, `[outro jingle]` x5, `[background noise]` x2, plus
`[wind blowing]`, `[zipper closing]`, `[phone ringing]`, `[typing]`, `[singing]`, `[silence]`, `[click]`.
Every one is truthy. Every one sailed through the guard and was graded.

24 came back with every dimension zero. Those zeros are averaged by `getTodaysMetrics` into what a rep reads
as their score: company-wide tone 46 against a speech-only 72, objection 33 against 52, talk_listen 34
against 52. Moses Maniquiz has 22 speechless pitches of 42 - more than half - and reads 37 for tone against
a true 69.

The other four are the ones that matter more. They came back with real-looking marks. `[typing]` was graded
tone 85 / close 80 / objection 75 - a top-quartile door pitch invented from the sound of someone typing, and
nothing on any screen distinguishes it from a pitch that happened. A rule of the shape "drop the all-zero
rows" would have left it in place, which is why the test is speech-presence and not score-shape.

The lesson is not "add sound-event strings to a list". It is that the guard tested for the SHAPE the author
imagined the failure would take (empty) rather than the PROPERTY that actually mattered (no words in it) -
and the two agreed on every case the author tried.

### F26 - the finding about NUL bytes contained a NUL byte
class: an-invisible-character-that-every-tool-tolerated
sweep: `tr -dc '\000'` over every file under `src/`, `scripts/` and this build directory
severity: low
F17 recorded a NUL byte in `sweepFairness.ts` that made `grep` call the file binary and three mutations
report "line not found". I wrote that finding up by quoting the character literally, so `check.md` itself
became a binary file - `grep -n "^### F" check.md` answered "Binary file check.md matches" and listed
nothing. The document explaining why an invisible byte breaks every tool was unreadable by those tools, and
it was committed that way at 8664f8b6.

The sweep that found it also found one more, in a file F17 never covered: `buildStoragePath.test.ts` holds a
literal NUL inside `"name.php\x00.png"`, a deliberate NUL-injection attack string. The byte was doing real
work there - it is what makes the test a real test - but it made that security test's file binary too.

Both are now the four printable characters, and both still mean exactly what they meant: `\u0000` parses to
a NUL at runtime (length 13, `.includes("\u0000") === true`), so the injection test is unchanged.

### F27 - I reformatted 100 lines of a file I had changed three lines of
class: a-tool-run-from-habit-rather-than-from-the-repository
sweep: `.prettierrc*`, a `prettier` key in `package.json`, and `printWidth` anywhere in the lint config
severity: low
Having edited `worker.ts` I ran `npx prettier --write` on it, the way I would in a repository that uses
prettier. This one does not. There is no `.prettierrc`, no `prettier` key in `package.json`, and the
canonical gate is `typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test` with no
formatting step in it. So prettier fell back to its own defaults - 80 columns against this repository's
~110 - and rewrote every import, signature and call in both files it touched.

The first commit was therefore 142 changed lines in `worker.ts` and 163 in `worker.test.ts` for a change
that is 17 and 31. Nothing broke: lint passed, types passed, 4267 tests passed. That is the point worth
recording - every gate was clean and the commit was still wrong, because the damage was to the next
person's ability to read the diff, and no gate here measures that.

The tell was available before I ran it and I did not look: the file I was about to reformat was already
formatted a different way, by the people who own it.

### F28 - half of all coaching produces nothing, and the record cannot say which nothing
class: four-different-failures-writing-down-the-same-word
sweep: `coach.dissect_attempted` payloads, all 100, grouped by `reason`; and every `return EMPTY` in `generateSalesDissect`
severity: high
Measured on production 2026-09-10, from the events table rather than from a log:

    month     declined  generated   decline rate
    2026-06          0          1     0%
    2026-07          0         35     0%
    2026-08         77         63    55%
    2026-09         23         22    51%

FIRST, THE CORRECTION, because I have been carrying the wrong reading of this shape. The jump from 0% to
55% is NOT a change in behaviour. `coach.dissect_attempted` was introduced by c70ecb13 on 14 August as the
dissect-backfill backoff marker; the first event is 2026-08-13T23:42Z, eighty minutes after that commit
landed. Before it, a decline wrote nothing at all. The declines were invisible, not absent, and any story
that starts "something broke in August" is a story about the instrument's birthday.

WHAT IS REAL is the rate itself and its shape: 92 of the 100 declines say `no_signal`, and the declined
calls are systematically the LONGER ones - median 683 transcript words against 341 for the ones that
succeeded, over the most recent 40 of each. None of the 40 declined had zero words. Thin content would be
SHORT. "No signal" is the wrong story for most of these.

THE DEFECT. `generateSalesDissect` has FOUR distinct empty exits, and each already had its own
`console.error` with its own sentence: a suppressed call, an EMPTY model response, unparsable text, and
valid text the tone law refuses for carrying no strengths. All four `return EMPTY`. The type carries no
room for which, so the distinction dies at that boundary and the stored marker writes one word for all of
them. The console lines survive in a serverless log nobody reads and are gone within the retention window.

That is why the model question on the build board is unanswerable. Token starvation and a wall-clock timeout
leave the same trace TODAY - but they do not have to. Starvation is `llm_empty`: the model returns no text at
all, which this file's own header records costing two weeks of blank reads in the 2026-07-30 outage. A call
with genuinely nothing to praise is `no_strengths`. They are different rows in the same table and were being
written as the same row.

### F29 - my own probe reported "0 of 0" from a 400
class: a-helper-that-turned-an-error-into-an-honest-looking-empty
sweep: the paged-read helper used by every measurement in this build
severity: medium
My paging helper treated any non-array response body as "no more rows". Querying `events` for a column that
does not exist (`session_id`) returned 400, the helper returned `[]`, and the script printed "sessions where
a dissect was ATTEMPTED and never GENERATED: 0 of 0" - a clean, plausible, entirely fabricated measurement.
I nearly reported it.

This is the identical defect to the one the whole build is about, in the tool I was using to measure it. The
helper now throws on any non-OK status or non-array body. A measuring instrument that reports zero when it is
broken is worse than no instrument, because it is believed.

### F30 - a rep could answer an unlabelled call but never correct a wrong one
class: a-precondition-written-as-a-label-when-it-was-really-about-authorship
sweep: `speaker` x `source` across all 2,414 stored segments, and the speaker composition of all 176 sessions
severity: medium
The answer route accepts a transcript only when every segment is `unknown`. That is right for the case it
was built for and wrong for the one beside it. Composition of the 176 sessions carrying segments:

    125  agent + customer     median 564 words   (canonical, nothing to do)
     43  agent only           median 249 words, 65 seconds   (a short door interaction; plausible)
      6  customer only        median   9 words
      2  unknown only         median 691 words   (the flow already handles these)

Four of the six customer-only sessions are a handful of words. Two are not: `d86baf84` holds 160 words
opening "Okay. Well, the whole reason I got sent out here, we've just..." - that is a rep's own doorstep
pitch, labelled end to end as the prospect. It declines with `no_agent_turns`, scores nothing, and the rep
can see it and cannot fix it. Re-transcription cannot help either: neither session has audio left.

WHY THE PRECONDITION WAS WRONG IN A WAY THAT LOOKED RIGHT. The rule is written as "only `unknown`", and its
comment justifies it as "attributed speech is canonical and is never rewritten by a later opinion" - which
is a true and important rule about A PERSON'S ANSWER. The code tests the LABEL instead of the AUTHOR, and
those two agree only while every label is human. They are not: of 2,414 segments, `source` is `null`,
`loudness` or `content` on every single one. NOT ONE is `manual`. No human has ever answered this question,
so the thing the precondition was protecting does not yet exist, while the thing it blocks is a rep
correcting a machine.

This is the same shape as F25 four findings ago - a guard testing for the form the author expected the case
to take rather than the property that actually mattered, with the two agreeing on every example tried.

### F31 - the route I had just extended answered 403 to every phone caller
class: the-cookie-client-class-again-this-time-in-the-half-that-resolves-the-company
sweep: every route reachable from the app, taken from the APP's own 34 fetch sites, cross-referenced against how each resolves the company
severity: critical
I finished F30, deployed it, and probed it against production with a real Bearer token for a real rep on
their own session. Every call answered:

    two-sided session    79bea05b -> 403 {"error":"No company context."}
    no answer in body             -> 403 {"error":"No company context."}
    another rep's call   77a7cba0 -> 403 {"error":"No company context."}

Not one of those reached the logic I had spent the hour on. The route resolves identity correctly -
`callerScopedDb(req) ?? await createClient()` - and then calls `getCurrentCompanyId()`, which builds its OWN
cookie client, ignores the one already resolved, finds no cookie, and returns null. The route turns that
into 403. An authenticated rep is told they have no company.

It is the same class as F22 and it is quieter, because the failure is indistinguishable from a genuine
permission problem in both the response and the log. `getCurrentCompanyId` also swallows every error into
`null`, so a transient database failure produces the identical 403.

WHAT THE SWEEP FOUND, done from the app's 34 fetch sites rather than by reading the server and guessing:
FOUR routes already carried a six-line inline fallback for exactly this, each with its own copy of the
comment explaining why - door-log, label-transcript, upload-recording, upload-recording/sign. TWO did not:
`attribute-unlabelled` and `auto-recover`. Those two are the answer-whose-voice-this-is flow and the
recover-my-dropped-call button, which are precisely the two things a rep reaches for when a call did not
come out right.

The lesson is not "two routes were missed". It is that a rule living in four copies is a rule half the
codebase has already forgotten, and that the whole of F30 was UNREACHABLE from a phone while every test
passed and the gate read clean. A unit test cannot see this and neither can the invariant audit; only
driving the real path with a real token can, which is rule 4 and the only reason it was found tonight
rather than by a rep next week.

### F32 - the dashboard had the same blind spot, and I had only fixed the phone
class: one-verdict-implemented-on-one-surface-while-the-other-kept-the-old-rule
sweep: every consumer of `captureIssue` in both repositories
severity: medium
F28 gave the decline marker a `shape`, and the mobile app was taught to use it: a call the coach CRASHED on
now says so, while a call it genuinely read and found little in stays silent. The dashboard was left
computing the old rule - `!dissect.has(id) && reason === "no_agent_turns"` - so on the surface the founder
actually uses, more than half of all sessions still showed no read, no badge and no reason.

That is a worse failure than the original, because it is the one this build already knew about. Shipping a
fix to one of two surfaces leaves them disagreeing about the same call, which is precisely the condition the
app's own `capture-issue.ts` docblock was written to warn against.

The two cannot share code: the app reads `coaching_sessions` straight from Supabase and never calls the
list route, which is a deliberate decision recorded in that same file. So the rule is mirrored, and both
copies pin the SAME six shapes and the SAME precedence in their tests - a change to one that the other does
not follow now fails rather than drifting.

### F33 - the Strategy Library showed a rep their best lines with no idea which call they came from
class: the-cookie-client-class-a-fifth-time-this-time-inside-a-data-helper-the-route-trusted
sweep: the import graph from all 12 cron routes and 3 workers (95 files), plus every caller of each bare cookie read it found
severity: high
After F31 I stopped trusting my reading and built the graph. Starting from every cron route and worker
entry point - contexts that never have cookies - and walking local imports, 95 files are reachable and
exactly three resolve a cookie client. Two of those pass it in from the caller. The bare ones were six
calls across `lib/brain/index.ts` and `lib/data/salesCoach.ts`.

Opening each caller rather than counting the grep, which is what turned a list of suspects into one finding
and four honest negatives:

  - `unlockControlGate`        one caller, a cookie-only web route. Correct as it stands.
  - `listAgentMeetingSessions` one caller, cookie-only. Correct.
  - `getCueRelianceSeries`     two callers, both cookie-only. Correct.
  - `getSessionCues`           ZERO callers anywhere, tests included. Dead.
  - `getLatestAfterPitchSummary` ZERO callers anywhere. Dead.
  - `listAgentSessions`        TWO callers, and BOTH are Bearer-reachable.

`listAgentSessions` is the finding. Both callers resolve a scoped client, use it for `auth.getUser()`, and
then call this - which resolved its own COOKIE client. Scoped for identity, anonymous for the read: F22's
shape exactly, five months after F22, in a data helper the routes trusted rather than in the routes.

MEASURED LIVE, because reading the code is what let this survive: `/strategy-library` with a real rep's
Bearer token returns 200 and 13 correct lines, with `sessionLabel` AND `outcome` null on ALL THIRTEEN. Both
are read from that list. A rep opening their Strategy Library on the phone sees their own best lines
stripped of which call they came from and whether it sold - the context that makes a line worth keeping.

344 tests across these routes passed while that was true. So did the invariant audit, for the reason A30
names: the route DOES mention `callerScopedDb`, so INVARIANT 26 sees a compliant route and the anonymous
read happens one function call away, where it cannot look.

The two dead readers are the same trap sitting unused beside their live `Admin` twins - each one a
cookie-client landmine that looks like a supported API. They are deleted rather than fixed: this repository
already holds the rule in `relabel-unknown.ts`, that "an unused code path is a claim that something needs
doing when it does not".

### F34 - my evidence for F33 was half wrong, and I nearly let it stand
class: a-probe-that-read-a-field-that-does-not-exist
sweep: the field names in every claim F33 made, checked against one raw response body
severity: medium (the fix is right; the proof I gave for it was not)
F33 said, as its headline measurement: "/strategy-library returns 13 correct lines with `sessionLabel` AND
`outcome` null on ALL THIRTEEN". Both halves of that are wrong in different ways.

FIRST, my probe counted `l.label`. The field is `sessionLabel`. `l.label` is `undefined` on every row of
every response, so that column of my output was measuring nothing at all and would have read "0 of 13"
against a perfectly working route.

SECOND, `outcome` really was null on all thirteen - and it is null on all 28 of that rep's sessions IN THE
DATABASE. It would be null under a perfect fix. I cited a true number as evidence of a defect it says
nothing about.

WHAT SAVED IT was deploying and re-running the probe instead of trusting the commit. The fix landed and the
probe still printed "0 of 13", which is the only reason I re-diagnosed rather than moving on. Re-read with
the right field name: 10 of 13 lines now carry a session label. Before the fix `sessions` was `[]`, `sess`
was undefined, and `sessionLabel` was necessarily null on every line - so the defect was real and is now
closed. The mechanism is proven; my measurement of it was not.

The lesson is narrower and sharper than "check your probes". A probe that reads a field name that does not
exist FAILS SILENTLY AND LOOKS LIKE A FINDING - it is the same disease as everything else in this build, a
path that produces nothing while nothing says so, this time in the instrument. F30 was the same defect in
the same tooling four hours earlier. Reading one RAW response body before counting anything would have
caught both.

### F35 - every number I put in front of the founder tonight spanned four companies
class: a-count-with-no-scope-stated-in-the-same-breath
sweep: every figure published to the build board today, re-run with `company_id` filtered to the founder's
severity: medium (the engineering numbers are sound; the business numbers were not the founder's)
This database holds seven companies. Every measurement in this build was taken across all of them, which is
CORRECT for the questions the code had to answer - "does the guard need to exist", "how many rows carry this
shape" - and WRONG for every number I put on the founder's decision board, because a founder deciding what to
do about their reps needs their reps.

Rescoped to the founder's own company:

    speechless door pitches      28 of 73  ->  24 of 45   (53%, worse than I said, not better)
    tone understated by          26 points ->  32 points
    dissect declines             100/121   ->  43/37 since mid-August (54%)
    declined vs generated words  683/341   ->  691/357
    sessions carrying an outcome 38 of 363 ->  23 of 197, across three reps not six

Three of the six reps in my first outcome table do not work for this founder. The `kpi/team` route quietly
said so - it answers `agents=2` - and I read past it twice before it registered.

The findings all survive rescoping and two get worse. That is not the point. The point is that
`a-count-has-a-scope` is a note I have written to myself, in this project, after making this exact mistake,
and I made it again four times in one night - because the scope is invisible in a `select` that omits the
filter, and a plausible number looks the same either way. It is the same shape as everything else in this
build: nothing said the figure was wrong.
