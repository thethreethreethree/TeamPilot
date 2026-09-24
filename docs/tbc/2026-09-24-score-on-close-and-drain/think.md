---
started_at: 2026-09-24T04:45:00Z
trigger: A partner asked "can we get the manager dashboard to start showing recordings?" and added "once it updates with past recordings I'll be able to have some more feedback". The tab was built and working. It was empty because nothing has ever scored a pitch without a human pressing a button.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the engine, the writer, the schema, the page, and no pipeline

## The complaint, and why it is not the bug it looks like

John Knudtson, 11:21: *"Hey can we get the manager dashboard to start showing recordings?"*
Then at 11:41: *"It's looking good!"* and *"Once it updates with past recordings I'll be able to
have some more feedback."*

The obvious reading is that the Recordings tab is unbuilt or unreachable. It is neither — it is
built, it is in the manager nav at `/dashboard/sales-coach/coach-assessment`, and two days ago its
design conformance was the subject of its own build.

**It is empty because `pitch_scores` is empty, and `pitch_scores` is empty because nothing fills
it.** Traced in `docs/AUDIT-UNTRIGGERED-ARTIFACTS-2026-09-24.md`:

- one writer — `storePitchScore`
- one caller of that writer — `pitch-score/route.ts:111`
- one caller of that route — a button in `PitchScorePanel.tsx:76`
- that component mounted on the **individual session page**

No cron among the twelve in `vercel.json`. No hook on any of the three ways a session ends. So the
table holds precisely the pitches somebody remembered to grade by hand, and ten modules read it.

## The part that should have been caught years ago

`pitch-score/route.ts:21`, written by whoever built the route:

> This is the trigger Project 1 was missing: the engine and the writer both existed and nothing
> called them, so 4,497 green tests described a system that had never scored a real pitch.

The lesson was found, understood, and fixed **as a button**. One layer out, inside the same
feature, the identical gap reopened — and A31 is the clause that names it:

> the seam between the database and the surface is where a correct system silently becomes a
> nonexistent feature, and it must be gated, not watched.

And it had already been solved once more, on 10 September, for transcripts:
`recover-transcripts-cron` exists because nine sessions had audio and no transcript, every one with
`auto_recover_attempted_at = null` — *"nothing had ever tried"*. Its own comment says an on-open
trigger would have left all nine where they were. Substitute "manager" for "rep" and "score" for
"transcript" and that is this.

## What the founder decided, and where I disagreed

Two pickers:

1. **Backfill: "Score everything now, one pass."** I had flagged that the one-pass option needs
   chunking anyway. It does — a function dies at 300s and 142 gradings do not fit. Building it as
   asked means one manager action that drains to the floor, not one HTTP request that half-finishes
   and returns nothing. So: each POST grades a batch and reports what remains, the caller loops,
   and from the manager's side it is still one action. That is also the contract the dissect
   backfill already uses, so it is not a new idea in this codebase.
2. **New pitches: "Score on session close."** Declined the cron variant.

Recording the disagreement I did not win and am not re-litigating: this codebase's own answer to
"drain a backlog of paid LLM work" is a capped cron with `CRON_CAP = 6`, explicitly so a backlog
*"drains over several hours rather than one unplanned bill"*. The founder chose the whole history
at once, having been told the trade. That is theirs to choose.

## What could go wrong, before writing any of it

1. **Three callers, three copies of "can this be scored?"** The button, the close path and the
   drain each need the session read, the kind check, the transcript, the grading, the store and the
   detection. Three inline copies is the §2.2 duplicated condition, and the failure mode is not
   theoretical — the 2026-08-14 outage discarded an answer it had already paid for because one
   consumer re-derived a gate and dropped a term.
2. **`suppressed` drains the whole backlog silently.** If the §3.4 control gate is declining, every
   session refuses identically. A drain that works through 142 of them to report `0` is the
   confident-zero this product exists to prevent (§1.5.3: fail LOUD).
3. **A loop that never terminates.** There is no `score_attempted_at` column. A recording with no
   rep speech stays a candidate forever, so "loop until remaining = 0" is an unbounded loop of
   paid calls.
4. **Double billing.** `/finalize` is reachable more than once for one session; the client retries
   it. A second grading bills twice and writes a second row every per-session read must then
   disambiguate.
5. **Scoring failing the close.** A rep finishing a call must never see an error because a grader
   was slow.
6. **The drain being rep-reachable.** It spends money across a whole company's history.
7. **A truncated candidate list.** A short page read as "the end" would under-report the backlog,
   and the entire value of showing the count first is that the number is trustworthy.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-24T04:16:08Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The request was 'show recordings'. Building toward that literally would have meant touching the Recordings tab, which is not broken. The understanding that changes the work is that the tab is downstream of a table nothing writes." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-24T04:16:08Z",
    "why_it_governs": "Methodology in the tree at the moment of action.",
    "how_this_build_will_embody_it": "Checked, and it caught something: an audit spec arrived naming six authorities, five absent from this tree. Escalated rather than quoting them." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "Layer 2 — does it work when a real user invokes it, end to end.",
    "how_this_build_will_embody_it": "Every layer above 2 was fine: the structure is sound, the composition works, the surface matches its design. Layer 2 was empty, and no amount of the others compensates. The sieve, exactly as described." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "THINK first, then search; look for adjacent problems.",
    "how_this_build_will_embody_it": "The adjacent problem found by looking was Pattern Interrupt: runDetection is called only from inside the scoring route, so Project 5 has never been able to open a pattern either. Nobody reported that one." },

  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-196", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "A dependency outside the code is not complete until verified or surfaced; prefer failing LOUD over silently.",
    "how_this_build_will_embody_it": "The month-1 control gate is exactly such a dependency. A drain that reports 0 without saying 'guidance is off' is the silent version, so suppressed halts the run and returns a sentence." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "One authority computes the decision; consumers branch on the returned verdict and never re-derive it.",
    "how_this_build_will_embody_it": "scoreSession is that authority, and it returns the refusal's MESSAGE as well as its reason — because my first pass had the route rebuild the sentence from a reason code and silently drop the session kind from it. The tests caught that; it is the exact drift the clause describes, in miniature." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "Append-only; state derived by replay.",
    "how_this_build_will_embody_it": "No migration. Scoring appends; nothing is edited or deleted. skipIfScored prevents a second row rather than overwriting a first." },

  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "355-365", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "Guide, don't overtake — surface the reasoning and let the human decide.",
    "how_this_build_will_embody_it": "The count is shown before anything is spent, and the cost trade on one-pass-versus-capped-cron was put to the founder with the codebase's own precedent, not decided quietly." },

  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "367-378", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "Month 1 is a control condition with no AI guidance; that is a deliberate product state, not a fault.",
    "how_this_build_will_embody_it": "suppressed is classified as PERMANENT and never retried by a sweep — retrying it would be a loop against a decision the product made on purpose." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "Distrust the fast confident answer.",
    "how_this_build_will_embody_it": "The fast answer was 'the Recordings tab needs wiring to the manager dashboard'. It is already wired. Four greps separated the complaint from its cause." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "The checklist; item 0 sends every founder decision to a picker.",
    "how_this_build_will_embody_it": "Both shape decisions went to pickers with a recommendation and the real trade, including the one where my recommendation lost." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "The methodology must be in the tree; having the label is not having the content.",
    "how_this_build_will_embody_it": "Five named authorities were absent and the substitution was approved before any clause was quoted." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "The route header, the transcript-recovery comment and the build plan are quoted from files opened this session, not recalled." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "560-566", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "Features sharing a name across modules get confused for one another.",
    "how_this_build_will_embody_it": "`pitches` (door log, processed every minute) and `pitch_scores` (rubric, processed never) share a word. Knowing the first is true is how someone comes to believe the second." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-698", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "One instance of a class; sweep to the boundary.",
    "how_this_build_will_embody_it": "Swept: 12 crons mapped, 13 derived artifacts classified, 11 covered and 2 not. The two uncovered are the two the partner is waiting on." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-778", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "A lesson in prose returns; gate it or it comes back.",
    "how_this_build_will_embody_it": "This build FIXES the instance and does NOT gate the class — a reachability check for 'writer only reachable from a component event handler' needs an allowlist with reasons or it becomes noise. Said plainly in remediate.md rather than implied." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-806", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "Schema-complete is not built; the write path is where a correct system becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "This is that clause's textbook case, and the codebase had already hit it twice — for transcripts and for scoring itself, one layer down." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "'Verified' names a command you ran.",
    "how_this_build_will_embody_it": "npm run check with its exit code, and an explicit statement that no part of this was run against a real database — the thing that would actually prove John's list fills." }
]
```
