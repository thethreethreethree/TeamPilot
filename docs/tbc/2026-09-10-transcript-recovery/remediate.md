# REMEDIATE - no recording with speech in it is left without a transcript

### F1 - a test asserted the defect
fix: `not-applicable (200) when there is no transcript / no agent turns` rewritten to
`RECOVERS a blank transcript - a call with audio and no words is exactly the case to fix`, with the
production count and dates in the comment above it. Two more tests added beside it:
`saves a blank transcript as UNKNOWN when the voice cannot be identified` and
`REFUSES to overwrite real agent speech with an unlabelled re-read`.
gate-or-promise: GATE. The rewritten test fails if the empty case is ever refused again, and it names the
nine sessions in its own body so a future reader cannot re-derive the old expectation as reasonable.

### F2 - a confident zero from the wrong table
fix: the bucketing script re-run against `coaching_transcript_segments`, the name taken from
`getSessionTranscript` in the data layer rather than recalled. Every figure in think.md replaced with the
corrected run; the earlier "13 of 16" estimate is superseded by the measured 9.
gate-or-promise: PROMISE, honestly labelled. This was a throwaway measurement script in the scratchpad,
not shipped code, and no gate covers a script that is not in the repo. What is in the repo is the table
name in exactly one place - the data layer - which is where the corrected run got it.

### F3 - two HTTP codes collapsed into one
fix: `RecoveryResult` failures carry `where: "upstream" | "internal" | "invalid"`; the route maps
upstream -> 502, internal -> 500, invalid -> 422, with a comment saying they are not interchangeable.
gate-or-promise: GATE, and it was the gate that caught it in the first place - the existing route test
pins the codes and failed with `expected 502 to be 500` the moment the extraction flattened them.

### F4 - answering would have destroyed the recovered timing
fix: `startSecondsFor(startedAt, spokenAt)` in the app reads the offsets back out of `spoken_at`;
`attributionFromTranscript` omits the key entirely when the answer is unknown rather than sending 0. The
recovery itself now also carries the diarizer's `start` through to `spokenAt`, which the route it
generalizes had been dropping.
gate-or-promise: GATE. `the offset is read back out of spoken_at, so answering keeps the timing`,
`an unknown time is never a zero` and `a line with no timestamp carries NO offset key at all` all fail on
a regression, and mutations MA and MC were run to prove they do.

### F5 - an unsubstituted placeholder in the previous build's record
fix: `docs/tbc/2026-09-10-derived-daily-goal/closure.md` line 36, `"opened_at": "%(NOW)s"` replaced with
the real timestamp `2026-09-10T15:58:00+08:00`.
gate-or-promise: PROMISE. `tbc:residual` reads `opened_at` as a string and has no concept of a value that
parses but means nothing. A checker for it would be process machinery the founder has not asked for, and
this build is not the place to add one - recorded here so the next person to touch the residual verifier
has the case in front of them.

### F6 - the sweep was an unbounded cost loop
fix: `MAX_TRANSIENT_RETRIES = 3` in `transcriptRecovery.ts`. `releaseMarker` counts prior
`coach.transcript_recovery_retry` events for the session, refuses to release past the budget, and refuses
to release at all when the count cannot be read - failing closed, because not releasing costs one delayed
recovery while releasing blindly is the loop itself.
gate-or-promise: PROMISE, and named as one. The budget is enforced in code and covered by the existing
suite, but nothing FAILS if a future caller adds a seventh release path that skips the tally. The honest
statement is that this is a bounded loop, not a gated one.

### F7 - the recovery could succeed and silently drop the timing
fix: after the atomic replace, if timestamps were SENT, read one back. `replace_session_transcript`
carries `spokenAt` only from 0249; the 0212 version selects a literal null, and BOTH return a count and
succeed - so a deploy ahead of the migration recovers the words perfectly and loses the timing with
nothing anywhere saying why. Production's ledger still ended at 0248 when this shipped. The check records
`coach.transcript_recovery_timing_lost` naming the session, so those calls can be re-recovered once the
migration lands. It deliberately does NOT release the marker: re-running would spend transcription every
hour for a condition only a migration can clear.
gate-or-promise: PROMISE, and a self-checking one - the code verifies its own write rather than trusting
it, which is the part worth keeping. Nothing FAILS on recurrence, so it is named as a promise.

### F8 - the sweep would have overwritten a rep's own answer
fix: `stateOf` now counts `unknown` separately, because its ABSENCE is what proves somebody answered.
`isRecoverable` checks two-sided FIRST, then refuses a customer-only transcript with no unknowns.
`mayOverwriteUnlabelled` requires both agent and customer to be zero.
gate-or-promise: GATE. `REFUSES a customer-only transcript - that is the rep's ANSWER, not a gap`,
`REFUSES to overwrite a rep's customer-only answer with an unlabelled re-read`, and
`still accepts a customer-only transcript that has UNKNOWN turns left in it` all fail on a regression;
mutations M5, M6 and M7 were run and each was killed by the test that names it.

### F9 - the sweep ran ahead of the migration
fix: `timingMigrationApplied()` reads the project's own migration ledger; the unattended sweep returns
`waitingForMigration` and spends nothing until 0249 is applied. Declines on an unreadable ledger too.
gate-or-promise: PROMISE, deliberately - it is a runtime precondition, not a test. A gate cannot express
"the production database has this function"; the honest structural answer is that the code refuses to act
while unsure, and says so loudly in the log and in its own return value.

## The class, swept to its boundary (A26 -> A30)
The class is not "auto-recover refused empty transcripts". It is **a session holds audio that no path
will ever transcribe**. Fixing the one precondition would leave the class alive for the next path that
stores audio without transcribing it.

The boundary is therefore not a document and not a code comment. It is the sweep's own candidate query:

    audio_asset_url IS NOT NULL  AND  auto_recover_attempted_at IS NULL  ->  and no usable transcript

That query does not know or care which code path created the session. A future upload route that stores
audio and forgets the words is repaired within the hour by machinery its author never has to know about -
which is A30's actual test: *does anything mechanical notice, without the author's cooperation?*

### F25 - 28 door pitches were graded on a recording with nobody talking in it
fix: `speechPresence.ts` owns one predicate - `transcriptHasSpeech()` strips every `[bracketed]`,
`(parenthesised)` and `*asterisked*` sound event plus all punctuation, and asks whether a letter or digit
survives. Both worker guards now call it instead of `.trim()`, and both report the one shared
`NO_SPEECH_ERROR` string. A transcript that mixes noise WITH speech ("[background noise] Hi, I'm John") is
still a real pitch and is still coached.
gate-or-promise: GATE, four mutations deep. Reverting the predicate to `text.trim().length > 0` fails
`[clicking] carries no speech` and `STT returns a SOUND EVENT ('[clicking]') -> same terminal, never
analyzed`. Reverting either worker guard individually fails its own named test and only its own. Forcing the
predicate to always return false fails `a transcript that MIXES an annotation with real speech is still a
pitch, and IS analyzed` - so the guard is pinned in BOTH directions and cannot quietly start refusing real
pitches. Every non-speech string in the test file is a verbatim production transcript, not an invention.

The 28 rows already stored are NOT touched by this fix. Excluding them from the averages changes numbers a
rep has already seen, and deleting or flagging stored analysis is the founder's call - it is on the build
board as `dead-analyses` with the measured impact table and a recommendation.

### F26 - the finding about NUL bytes contained a NUL byte
fix: both literals are now the four printable characters `\x00` (in the prose) and `\u0000` (in the test
source). `check.md` is text again - `grep -c "" check.md` answers 561 where it previously answered nothing.
gate-or-promise: GATE for the test, PROMISE for the prose. `buildStoragePath.test.ts` still passes 4 of 4
with the escape, and `\u0000` parses to a real NUL, so the injection case is byte-identical at runtime. The
prose has no gate - there is no check that a document stays greppable, and I am not adding one: rule 7 is
explicit that I build the product, not the machine that watches me build it.

### F27 - I reformatted 100 lines of a file I had changed three lines of
fix: both files restored from 8664f8b6 and the three guard edits plus the three tests re-applied by anchored
substitution, so the diff is now 17 lines in `worker.ts` and 31 in `worker.test.ts`. The new
`speechPresence.ts` was hand-set to the repository's own width rather than prettier's. All four mutation
proofs re-run against the restored files - M1 had to be re-anchored because its target line had changed
shape, and it reported "1 passed" rather than a false failure while it was mis-anchored, which is the
behaviour a mutation harness must have.
gate-or-promise: PROMISE. There is no formatting gate in this repository and I am not adding one - rule 7,
and A33: a gate that fires on style in a codebase that has deliberately chosen not to enforce style is
noise. The structural answer is smaller than a gate: do not run a formatter the repository does not
configure.

### F28 - half of all coaching produces nothing, and the record cannot say which nothing
fix: `SalesDissect` gains `emptyShape`, and each of the six empty exits says which it is - `no_agent_turns`,
`suppressed`, `llm_empty`, `unparsable`, `no_strengths`, `threw`. `runAndStoreDissect` writes it to the
marker as `shape`, BESIDE `reason` rather than instead of it: the sessions-list route reads that two-word
vocabulary and it is unchanged. Nothing about which sessions are declined, or the 14-day backoff, moves.
gate-or-promise: GATE, three mutations. Collapsing `unparsable` into `no_strengths` fails "text that is not
dissect JSON → unparsable, NOT llm_empty" and "non-JSON text stores shape 'unparsable'". Cutting the shape
out of the payload fails all four marker tests and none of the generator tests, so the two halves are pinned
separately. Reporting an empty model response as `no_strengths` - the mutation that matters, because it is
the one that would quietly re-merge starvation with a genuinely quiet call - fails "EMPTY text back from the
model → llm_empty - this is the starvation shape".

What this does NOT do is fix the decline rate. It makes the next month of declines answerable: `llm_empty`
means starvation and a longer transcript makes it worse, `no_strengths` means the call really had nothing to
praise. That is the evidence the `dissect-model` decision on the build board needs and has never had, and it
accumulates on its own from here.

### F29 - my own probe reported "0 of 0" from a 400
fix: the paged read throws on any non-OK status or non-array body instead of returning `[]`.
gate-or-promise: PROMISE. It is a scratch script, not shipped code, and putting a gate on a throwaway would
be exactly the bureaucracy rule 7 forbids. The durable part is the finding: I built the failure I was hunting
into the instrument I was hunting it with, which is A36 - the thing I was most confident in was the thing
hiding the defect.

## The speechless-transcript class, swept to its boundary (A26 -> A30)
F25 fixed door pitches being graded on a recording with nobody talking in it. The question that decides
whether the fix is a fix or a patch is whether the same thing happens on the OTHER transcript path - the
sales sessions the five coaching engines read.

Swept: all 2,414 rows of `coaching_transcript_segments`, stripped of every bracketed and parenthesised
event. Of 176 sessions carrying segments, ZERO have no speech in any segment. Of 2,414 individual segments
exactly one is pure non-speech, and it is a CJK full stop, not a sound event.

The reason is structural rather than lucky. The session path uses DIARIZED transcription, which emits a
segment per speaker turn; the door-pitch path takes ONE FLAT transcription of the whole file, and that is
the output shape that carries `[clicking]`. So the boundary of the class is the flat-transcription path,
and it has exactly one member - which is now guarded at both of its ends.

Recorded because a sweep that finds nothing is a result. Left unwritten, the same question gets asked from
scratch by the next person, and the honest answer costs another hour to rediscover.

### F30 - a rep could answer an unlabelled call but never correct a wrong one
fix: `answerableSpeaker()` replaces the label test with an authorship test. A transcript is answerable when
it carries ONE speaker throughout and NO segment was written by a person (`source: "manual"`), whichever
label the machine chose. Two voices are still refused - re-attributing captured two-sided speech wholesale
is a deletion, not a correction - and a transcript any human has answered is still refused, including
against their own second opinion. `TranscriptSegment` now carries `source` (optional; both reads already
selected `*`, so no query changed and no caller broke), and the update filter follows the speaker that was
READ rather than the literal `"unknown"`.

The recovery SWEEP is untouched and still refuses customer-only transcripts. That refusal was the right call
and this does not weaken it: a machine second-guessing a rep and a rep correcting a machine are opposite
acts, and only the second one is added here.

Also added: an answer that already matches what is stored returns `unchanged` and writes nothing, instead of
reporting a save over an empty write and paying for a regeneration of a read that already exists.
gate-or-promise: GATE, four mutations, each caught by its own named test and no other. Removing the `manual`
guard fails "REFUSES when a person already answered, even though there is only one voice". Letting a
two-voice transcript through fails four tests across both files. Restoring the literal `"unknown"` filter
fails "scopes that update to speaker=CUSTOMER - the filter follows what was read, not a literal", which is
the one that matters most: left alone it would match no rows and report a successful save over a write that
changed nothing. Removing the no-op branch fails "changes NOTHING and spends nothing when the answer already
matches what is stored".

### F31 - the route I had just extended answered 403 to every phone caller
fix: `callerCompanyId(db, userId)` - one helper, tried cookie-first so the web path is byte-for-byte
unchanged, falling back to the caller's own profile row read THROUGH THE CALLER'S OWN CLIENT so RLS still
decides. All six routes now call it, including the four that had their own working copy. Those four were
folded in deliberately rather than left alone: four copies of a rule is how two routes came to be missing
it, and the next route somebody writes would have made it five.
gate-or-promise: GATE, two compiling mutations. Making the helper return the cookie value only - the
original defect exactly - fails "falls back to the caller's own profile row when there is NO cookie - the
phone path" and "reads through the client it is GIVEN, so RLS still decides". Pointing the fallback at
another user's row fails the same two. My first attempt at the first mutation did not typecheck; it is
recorded because a mutation that does not compile proves nothing, and reporting it as a pass would have
been the same error as the one being fixed.

VERIFIED AGAINST PRODUCTION, not just tested: the same probe that found the 403 is what confirms the fix,
run again after the deploy. A unit test could never have found this and did not - all 4,297 passed while
the route was unreachable from every phone.

## The cookie-client class, swept to its boundary a second time (A26 -> A30)
F31 was found by driving ONE route with a real token. The question that decides whether that was a fix or
a lucky catch is how many others answer the same way, and the honest way to find out is to drive them all
rather than read them.

Enumerated from the APP's own call sites, not from the server: every `coachPost` / `coachPatch` in the
mobile codebase, 36 call sites resolving to 9 distinct write paths. Every one was then driven against
production with a real Bearer token for a real rep.

ZERO-RISK BY CONSTRUCTION, which is what made it worth doing at all: each session-scoped route was given a
random UUID belonging to no session, so the route MUST refuse and cannot write. Company resolution happens
before the session lookup, so a route still carrying the defect answers "No company context." anyway —
the probe distinguishes the two without ever reaching a write.

    ok  404  POST   .../attribute-unlabelled      Session not found or not accessible.
    ok  400  POST   .../label-transcript          Validation failed. (segments)
    ok  404  POST   .../auto-recover              Session not found or not accessible.
    ok  400  POST   .../outcome                   Validation failed. (outcome)
    ok  400  PATCH  /api/coach/sales-session/<id>  Validation failed. (nothing to update)
    ok  404  POST   .../upload-recording/sign     Session not found or not accessible.
    ok  404  POST   .../upload-recording          Session not found or not accessible.
    ok  400  POST   /api/coach/sales-session/door-log        Validation failed. (kind)
    ok  400  POST   /api/coach/gamification/notifications    Validation failed.

9 of 9 resolve the caller's company from a phone token.

The boundary is worth stating precisely, because it is also the reason this went unseen: the GET probe run
earlier in this build reported 19 of 19 healthy and was TRUE. The defect was on a POST, and no POST had
ever been driven. A sweep is only as wide as its verb.

### F32 - the dashboard had the same blind spot, and I had only fixed the phone
fix: `src/lib/coach/v5/readIssue.ts` holds the rule for the web; the list route returns `readIssue` in place
of `captureIssue` (renamed rather than added beside it - two fields expressing one overlapping verdict is
how the two surfaces would drift again), and the sessions page renders a second badge. The badge uses
`AlertTriangle` rather than `Sparkles`, because `Sparkles` already means "Dissect" on the very same row and
one icon meaning two things is a defect a screenshot would not reveal.
gate-or-promise: GATE, four mutations, each caught in BOTH the unit test and the route test - so the rule and
its wiring are pinned separately rather than by one shared assertion. Putting `no_strengths` in the retry set
fails the two silence tests. Treating a shapeless older decline as a failure fails three, including the
pre-existing "reason 'no_signal' is NOT flagged one-sided" - which is the old invariant proving it still
holds. Dropping the has-a-read short circuit fails three. Letting a shape outrank one-sided fails two.

### F33 - the Strategy Library showed a rep their best lines with no idea which call they came from
fix: `listAgentSessions` takes an optional RLS-scoped client, defaulted so no caller broke, and both
Bearer-reachable callers now pass the one they already resolved. `getSessionCues` and
`getLatestAfterPitchSummary` are deleted - zero callers, and each a cookie-client trap beside a live Admin
twin.
gate-or-promise: GATE. `listAgentSessions.scopedClient.test.ts` pins BOTH directions: the passed client is
what gets read, AND no cookie client is resolved when one is passed - the second assertion is the one that
matters, because a fallback that still fires would pass a naive "it returned the right rows" test on the
web while staying broken on a phone. Reverting the parameter fails "reads through the client it is GIVEN,
and never resolves a cookie client" and nothing else.

The verification that counts is not the test. The same probe that found it, re-run after the deploy, is
what says a rep's lines carry their call again.

## The cookie-client class, swept to its REAL boundary (A26 -> A30)
The cron sweep that produced F33 found it by luck: `salesCoach.ts` happens to be imported by a worker as
well as by two routes. The class's boundary is not crons. It is any route that accepts a phone - such a
route resolves a scoped client for identity, hands off to a helper, and if the helper resolves its OWN
cookie client the read is anonymous and comes back as an honest-looking empty. F22, F31 and F33 are all
that one sentence.

So the sweep was re-run from the right entry points: every `route.ts` mentioning `callerScopedDb` or
`resolveApiAuth`. 33 routes, 105 helper files on their import graphs.

    SUSPECTS - helpers on a Bearer path resolving their own cookie client: 1
    lib/brain/index.ts:160   (reached by 10 routes)   const supabase = await createClient();

One suspect, and it is a false positive of a module-level graph: those ten routes import `@/lib/brain` for
`runBrainCall`, not for `unlockControlGate`, which is the function on line 160. Its only caller anywhere is
`app/api/brain/unlock/route.ts`, a cookie-only web route - opened and confirmed, not assumed.

So after F33 there is no other helper on any Bearer-reachable route that reads through a client of its own.

TWO LIMITS OF THIS SWEEP, stated because an over-claimed clean result is worse than no result. It is
MODULE-level, not function-level, so a hit means "this module is imported", which is why the single hit
needed a human to close it. And it only knows the shapes it was taught - `createClient()` from
`@/lib/supabase/server`, bare or `??`-defaulted. A helper reaching for cookies some other way is invisible
to it, exactly as INVARIANT 26 is blind to a route that mentions `callerScopedDb` and then reads without it.

That is A30's real test, and the honest answer here is partial: the class is closed for the shapes I know,
by evidence rather than by reading, and the next member of it will be found by driving a real path with a
real token - as all three of tonight's were - rather than by a check.

### F34 - my evidence for F33 was half wrong, and I nearly let it stand
fix: the probe reads `sessionLabel`, and the `outcome` claim is withdrawn - `outcome` is null on all 28 of
that rep's sessions in the database and proves nothing either way. F33's fix is unchanged and is VERIFIED:
with `325263c` serving, 10 of 13 correct lines carry a session label where the mechanism guarantees all 13
were null before.
gate-or-promise: PROMISE, and a weak one, which is worth saying rather than dressing up. There is no gate on
a scratch probe and I am not building one - rule 7. The structural answer is a habit: print ONE raw response
body before counting anything in it. Both times my tooling lied to me today it was because I counted a shape
I had assumed rather than one I had looked at.

The commit message on F33 (325263cd) carries the overclaimed version and cannot be edited now it is pushed.
This entry is the correction, and it is deliberately placed where the finding is rather than only in a
message nobody re-reads.

### F35 - every number I put in front of the founder tonight spanned four companies
fix: every figure on the decision board is rescoped, and each panel carries the correction in the founder's
own words rather than being quietly swapped - they had already read the wrong ones. The engineering numbers
in this document and in the commit messages are left as they are, because a database-wide count is the right
answer to "does this guard need to exist"; this entry is the note that says which scope each is.
gate-or-promise: PROMISE. There is no gate on a scratch query and rule 7 forbids building one. The habit is
the fix and it is narrow enough to state as a rule: a query whose result will be shown to the founder gets
`company_id` in the `select` or it does not get published.

### F36 - three screens promise a thing the founder deliberately switched off two days ago
fix: all three strings now say what is true - the number is kept, it is NOT being used yet, and why (a first
version made the guessing worse). The comment above the web prompt carries the un-wiring date so the next
person to read it does not re-promise it. Whether to keep ASKING at all is the founder's call and is already
on the build board; the copy stops lying in the meantime rather than waiting on that.
gate-or-promise: PROMISE. There is no gate that can tell a true sentence from a false one, and inventing a
copy-linter for it would be the bureaucracy rule 7 forbids. The durable part is where the correction lives:
the un-wiring decision is now quoted in the copy's own comment, so the claim and the reason it is false sit
in the same place rather than three files apart.

npm test (app) -> 1301 pass, 0 fail. node tools/gate.mjs -> G1-G4 PASS, G5 NOT RUN.
