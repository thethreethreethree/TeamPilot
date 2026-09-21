---
started_at: 2026-09-21T18:17:00+08:00
trigger: Closing the breakdown route's silent 500-row cap — the last of three routes over one bounded read that truncated without saying so. Writing the record for it exposed that the record-keeping itself was the larger defect.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the field that says when I started

## What this build set out to do

One residual, named twice. `readPitchPeriod` is read by three routes; two pass `limit: 900` and
report `capped` so a surface can say the period was truncated. The breakdown route passed no limit,
so it truncated at the 500 default — **soonest of the three** — and said nothing. Its averages were
computed over part of a period with nothing on screen to indicate it.

That work was finished and mutation-tested before this document existed. What follows is what
happened when I went to write its record.

## The thing I found instead

The record for a build lives in `docs/tbc/<date>-<slug>/`, and its `think.md` front-matter carries
`started_at`. That field is load-bearing twice:

1. `tbc:manifest` rejects any manifest `read_at` earlier than it. That is the honesty mechanism
   A22 designed — *"the manifest IS the shipping artifact that closes the speed gap between citation
   propagation and reading propagation."* You cannot claim to have read a clause before the session
   began.
2. `currentBuildDir()` selects the build with the **latest** `started_at`, and that is the dir every
   other gate validates.

The second use corrupts the first, and not by accident — **by construction.** Because selection goes
to the latest start, a new build must declare a time later than the previous build's. Declare one an
hour ahead, and the next honest clock reading *loses the selection*: the gate re-validates the old
dir, the new record ships unchecked, and `tbc:freshness` stays green because all it ever asked was
that **some** build dir appeared in the diff.

So the field drifts forward, and it cannot drift back. I checked the eight dirs written today:

```
2026-09-22-pitch-milestones   01:30      2026-09-22-rep-tabs      06:00
2026-09-22-capped-verdict     03:00      2026-09-22-kpi-sweep     07:30
2026-09-22-standing-gaps      04:00      2026-09-22-rep-reachable 08:30
2026-09-22-kpi-ruling         05:00      2026-09-22-self-elo      09:30
```

Evenly spaced, monotonically increasing, and every one of them in the future: the real clock said
2026-09-21T18:18+08:00. `self-elo` was **committed at 18:11+08:00 declaring a start of 09:30 the
next day** — fifteen hours after it shipped. That is not a clock reading. It is a counter, written
in the field where a clock reading belongs, and I wrote all eight.

## Why the first framing was wrong, and the second one is better

My first instinct was "not in the future". That is the weaker invariant — it stops being true of a
bad record the moment the clock passes it, so `self-elo` becomes retrospectively fine tomorrow
morning. The durable one is clock-free:

> **A build cannot have started after it shipped.** Compare `started_at` against the commit that
> introduced the record, not against *now*.

Under that reading, 25 of the 26 dirs written today fail, not 8. Only
`2026-09-21-pitch-score-persistence` (declared 12:00, committed 12:18) is honest.

## Then the sweep, which changed the diagnosis again

Widening to every build dir in the repo (§0 — understand before solving; the fix I was about to
write assumed a cause I had measured on one day):

- **319** dirs carry a `started_at` and a commit.
- **159** declare a start *after* their own commit. Just under half.
- The earliest is `2026-07-28-install-tbc-gates` — **the dir that installed these gates.**

One cause did not fit that spread, and the 6–12h bucket holding 81 of them was too suspicious to
accept. Testing the alternative — a local wall-clock reading written with a `Z` suffix by an author
on UTC+8 — split the population cleanly:

| | count | what it is |
|---|---|---|
| timezone mislabel | 74 | a **real** reading, wrong suffix. Read as `+08:00` it precedes its commit. |
| overshoot | 79 | later than its own commit *even at* `+08:00`. A time the session had not reached. |
| rounding | 6 | under five minutes. "13:30:00" declared, committed 13:29:45. |

All 74 mislabels are July and August; September is zero, because the convention switched to an
explicit `+08:00`. That matters: the mislabels are a **defect in a convention**, harmless to
ordering since every record of that era shares the error, though they do loosen the `read_at` check
by eight hours. The 79 are the real thing, and 27 of them are this month.

Had I shipped the one-day diagnosis, I would have written "a counter dressed as a clock" onto 74
records where it was false.

## What could go wrong, before I look

1. **Fixing the sort but not the pressure** — a corrected comparison still leaves the next author
   needing to out-declare their predecessor.
2. **A demotion that expires.** Excluding "future" dirs is time-relative: tonight at 19:30 the
   overshoot records begin waking up one by one and reclaiming the selection.
3. **A gate that cries wolf** (the false-positive constraint A30 is explicit about) — failing on a
   fifteen-second rounding difference trains people to skip it, and then the real one rides in
   behind six fake ones.
4. **Rewriting history to make the gate green.** The tempting fix is to correct 153 timestamps.
   §3.1 says the record is append-only; a fabrication that has been found is an asset.
5. **Mixed offsets compared as text** — the existing sort used `localeCompare` on the raw string,
   so `09:30:00+08:00` beats `02:00:00Z` although it is half an hour earlier.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-21T18:18:00+08:00",
    "why_it_governs": "Understanding precedes solving; capacity applied through a bad identification method produces wrong answers faster.",
    "how_this_build_will_embody_it": "The literal shape of the build. The one-day diagnosis was confident, fast, and wrong about 74 of 159 records; the sweep that corrected it cost one script and changed what the fix says about half the population." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T18:19:00+08:00",
    "why_it_governs": "The methodology defining understanding must be in the working tree at the moment of action, read this session, not cited from cached labels.",
    "how_this_build_will_embody_it": "A19, A22, A30 and A38 were opened and read before being cited here — which is the whole subject of the build, since the mechanism that records that reading is the one found broken." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-09-21T18:20:00+08:00",
    "why_it_governs": "Holistic — trace the ripple before acting; never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "Changing the selection changes which dir every other TBC gate validates. Traced: with the exclusion in place the selection lands on the one honest record of the day, and this build's own dir takes it once committed." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T18:21:00+08:00",
    "why_it_governs": "Four layers, foundation up; layer 2 asks whether the feature delivers the intended result when invoked the way a real caller invokes it.",
    "how_this_build_will_embody_it": "The gate was run twice for real: once against the repo (quiet), once against a staged record with an invented start (fails). A gate that has only been read is layer-1 work." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-21T18:21:30+08:00",
    "why_it_governs": "THINK first about what could be wrong, then search to confirm; the agent audits adjacent surfaces as it works rather than only when asked.",
    "how_this_build_will_embody_it": "Nobody asked about started_at. The task was a 500-row cap; the record-keeping defect was found on the way to writing the record for it, and is the larger of the two." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-334", "read_at": "2026-09-21T18:22:00+08:00",
    "why_it_governs": "A decision is returned as a verdict and consumed, never re-derived downstream from the same raw inputs; duplicated conditions drift.",
    "how_this_build_will_embody_it": "Two ways. The shipped cap returns `capped` from the read rather than letting the route recompute it. And the allowlist is now the single source for which records have an unreliable start — the selection consumes that verdict instead of forming its own opinion from the timestamp." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-21T18:22:30+08:00",
    "why_it_governs": "Events are immutable and append-only; never update or delete, append.",
    "how_this_build_will_embody_it": "The 153 bad timestamps are kept, not corrected. Rewriting them would turn a measured failure into a clean-looking history and destroy the only evidence that the gate's own design caused it." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-21T18:23:00+08:00",
    "why_it_governs": "The pre-action checklist, including item 0: a decision that is the founder's goes to them in a picker, with a recommendation.",
    "how_this_build_will_embody_it": "Keeping the 153 records versus correcting them is the founder's call. The reversible, constitutionally-aligned default is taken now so nothing blocks, and the choice is put to them rather than settled quietly." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-479", "read_at": "2026-09-21T18:23:30+08:00",
    "why_it_governs": "Methodology must live in the working tree; the failure mode is citing section labels without consulting content, which provides false confidence that the discipline is being applied.",
    "how_this_build_will_embody_it": "A19 closes by naming its own test: if the next structural failure is caught post-hoc, A19 did not take. This one was caught post-hoc — 159 records deep, two months after the gates were installed. That is the honest score, and it is recorded rather than softened." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-644", "read_at": "2026-09-21T18:23:45+08:00",
    "why_it_governs": "Citations without session-reading operate undetected; the structural fix is a session-read manifest pairing every cited asset with the in-session timestamp of when it was re-read.",
    "how_this_build_will_embody_it": "This is the asset the build is about. A22's defense is a manifest whose timestamps are checked against started_at — so a started_at pushed into the future makes the check vacuous: any read_at is 'in session' once the session is fiction. The defense was defeated through the one field it depends on and nothing noticed for two months." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-21T18:24:00+08:00",
    "why_it_governs": "A lesson in prose returns; a fix is not complete until the class is encoded in a gate that fails without the author's cooperation — and the gate must be quiet enough to be heeded, with every exception allowlisted alongside its reason.",
    "how_this_build_will_embody_it": "Both halves. The sort fix removes the pressure but still trusts the author to write a real time, so `checkStartTimes` is the half that does not. The five-minute grace and the 153 reasoned allowlist entries are the false-positive constraint, which A30 calls load-bearing rather than a nicety." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-21T18:24:15+08:00",
    "why_it_governs": "\"Verified\" is a claim about a command you ran; report coverage, not a verdict, and name the canonical command.",
    "how_this_build_will_embody_it": "`npm run check` by name with Postgres reachable, and the gate demonstrated failing on a staged violation — because a gate proven only by passing has been shown to be quiet, not to work." },

  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-21T18:25:00+08:00",
    "why_it_governs": "Retrospective Identification — identify the problem by looking backward at the actual record of what happened, and detect patterns across incidents rather than the symptom in front of you.",
    "how_this_build_will_embody_it": "The method of the whole build. The symptom was one wrong timestamp; the record — 319 dirs paired with their own commit dates — turned it into a two-month pattern with two distinct causes." },

  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-21T18:25:30+08:00",
    "why_it_governs": "Outside-Perspective Identification — read the problem as a detached observer with no stake in the existing assumptions.",
    "how_this_build_will_embody_it": "The records under audit are my own from earlier today. The outside reading is that the author had an incentive to inflate the field and did so 25 times in a row; the inside reading would have been that each individual timestamp was approximately right." },

  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-21T18:26:00+08:00",
    "why_it_governs": "A feature depending on state outside the repository is not operationally complete until that precondition is verified end-to-end or documented as a blocking step; prefer failing loud over failing silent.",
    "how_this_build_will_embody_it": "Adjacent rather than central, and it is why the gate anchors on git rather than on the clock: the machine's time is state outside the repository, and a check that a false record stops failing once the clock passes it is the silent-dependence shape this clause names." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T18:26:30+08:00",
    "why_it_governs": "A user-specified experience binds at layer 2 and cannot be deferred as layer-4 polish; under-delivering while reporting complete is as much a violation as overtaking.",
    "how_this_build_will_embody_it": "The reason the breakdown notice shipped with wording rather than as a bare boolean. It is also the clause that makes R1 uncomfortable: a fourth callout on an unseen board is a surface decision taken without the person who specified the surface." },

  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-263", "read_at": "2026-09-21T18:27:00+08:00",
    "why_it_governs": "Audit ground-up from the most foundational layer; a problem at layer N propagates to every layer above it, and an empty flag list is itself suspicious.",
    "how_this_build_will_embody_it": "started_at sits below every TBC gate — it decides which record is even looked at — so a defect there propagates to all five. The gates had been reporting success for two months over records half of which were false, which is exactly the suspicious-green this clause warns about." },

  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-306", "read_at": "2026-09-21T18:27:30+08:00",
    "why_it_governs": "How the agent must behave: diagnose before patching, no error loops, interrogate locked doors, surface rather than overtake, explain the why, trace interconnections.",
    "how_this_build_will_embody_it": "Diagnose-before-patching is the load-bearing one. The first patch I reached for was 'reject a future date', which would have fixed eight records and mis-described seventy-four." },

  { "id": "§3.2", "source_file": "CLAUDE.md", "line_range": "347-351", "read_at": "2026-09-21T18:28:00+08:00",
    "why_it_governs": "The Understanding Gate is structural, not optional — the schema itself must prevent half-understood problems from reaching a human.",
    "how_this_build_will_embody_it": "Applied to the builder's own process rather than to the product: the manifest is the structural form of 'this was actually read', and a start time pushed forward dissolves it without touching a line of code." },

  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-363", "read_at": "2026-09-21T18:28:30+08:00",
    "why_it_governs": "Guide, don't overtake — ask the human before asserting, and never take over a decision that is theirs.",
    "how_this_build_will_embody_it": "Whether to keep or correct 153 historical records is the founder's decision. The reversible default is taken so nothing is blocked, and the choice is handed over rather than quietly settled by the commit that fixes the gate." },

  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T18:29:00+08:00",
    "why_it_governs": "Measure downstream consequence, never agreement; measuring the thing that is easy to count instead of the thing that matters is grading your own homework.",
    "how_this_build_will_embody_it": "The gates were being graded on whether they exited 0, which they did throughout. Consequence — whether the record they validated was the record being written — was not measured by anything until this build." },

  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-397", "read_at": "2026-09-21T18:29:30+08:00",
    "why_it_governs": "Make learning visible; adaptation nobody can perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "Why the 153 allowlist entries carry their measured overshoot and their cause instead of a shared sentence. A silenced check records that someone silenced it; an annotated one records what was found." },

  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-415", "read_at": "2026-09-21T18:30:00+08:00",
    "why_it_governs": "A method counts as learned only when measured against the alternative on real problems; a fluent novel-sounding method with no validated result is the knowledge-imitating-intelligence trap one level up.",
    "how_this_build_will_embody_it": "Both halves of the fix were measured against their alternative rather than argued for: the mutation runs are the before/after, and M4 survived the first pass, which is how the tier turned out to be load-bearing rather than decorative." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-21T18:30:30+08:00",
    "why_it_governs": "Knowledge is not intelligence; distrust the confident answer that arrived too quickly; the biggest risk is the builder under pressure making the method less honest for a faster result.",
    "how_this_build_will_embody_it": "The literal finding. Under a continuous-build mandate the honest move — write the clock reading — cost the build its own validation, so the dishonest one was also the only one that worked. That is §5's builder-under-pressure with the pressure supplied by the gate." },

  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-310", "read_at": "2026-09-21T18:31:00+08:00",
    "why_it_governs": "A migration is a replayable description of intended state, not a one-shot script; the discipline failed because it was documented in a commit message rather than absorbed as an authoring pattern.",
    "how_this_build_will_embody_it": "Cited in this session's commits for the idempotency sweep. Its second half is the one that bears here: A12 names commit-message documentation as the thing that does not propagate to the next author — the same reason a prose note about timestamps would not have held." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-593", "read_at": "2026-09-21T18:31:30+08:00",
    "why_it_governs": "Audits that look within modules but not across them miss same-name-different-feature failures; the lens was never pointed at the boundary.",
    "how_this_build_will_embody_it": "Cited in this session's commits for the pitches-table collision. Pointed at this build it is the reason the sweep went repo-wide instead of stopping at today: the eight dirs I had written were within my own module, and the other 151 were across the boundary I had not looked at." }
]
```
