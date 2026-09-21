# CLOSURE — encoding the technique that kept working

Three modules in one feature, in one day, had no caller. The scoring engine. Its writer. And an
aggregator carrying seventeen passing tests behind both of them, holding every rubric average a
rep would ever see.

The first two were found by hand, while building the thing that should have called them. The
third was found by counting importers — a thirty-line script — and that is the only reason this
build exists. A technique that works three times in one day and lives in nobody's head is a
lesson recorded in prose, and A30 is unambiguous about what happens to those.

What makes the class nasty is that every instance looks like progress. The test count rises. All
six gates stay green. The module is arguably *more* finished than the ones that shipped, because
nothing has made it compromise with reality yet. Nothing anywhere says it cannot be reached.

A33 is the clause that decides whether this may be a gate at all, and it passes for a specific
reason: counting importers involves no judgement. There is no "is this really unused" call to
make. Either a non-test file names the module or none does.

The sweep found six beyond the pitch package, and they split cleanly. Three are deliberate and
each says so in its own file — a TS mirror of SQL kept as a regression lock, the Door Log offline
queue held dormant by a founder decision in August, and an honest nav placeholder unused because
every nav item currently has a real destination. Those are the good state, not defects.

Three are debt nobody chose.

The sharpest is `emit.ts`. It went dead on 2026-06-13, in a commit that said so plainly:
*"emit.ts is now technically dead… Future cleanup will retire emit.ts + the v3 readout
together."* That was three months ago. Meanwhile `/api/admin/coach-readout` and
`/api/brain/learning-summary` still read the `coach.suggestion_*` events it used to write.
Nothing has written one since June, so those surfaces report an accept rate that stopped moving,
with nothing on them saying so. A measurement instrument whose input quietly stopped flowing is
the §3.5 problem in its purest form — it is not measuring the wrong thing, it is measuring
nothing while looking exactly the same.

The other two are quieter and the same shape. `EmptyState` was built so a brand-new tenant does
not land on a blank module, and is adopted by nothing, so that problem is unsolved everywhere.
`fetchJson` was built to close the error-dressed-as-no-data class at source, and is adopted by
nothing, so the class is policed after the fact by an audit rule instead of prevented by a
primitive. Someone did the work; nothing reached it. Exactly the pattern that produced today's
three.

Turning the gate green by allowlisting all six would have taken ninety seconds and been the §5
shortcut in its purest form — everything for the builder, nothing for the system. So each entry
opens with **DELIBERATE** or **DEBT**, and the DEBT entries carry the decision that created them,
the date, and what is wrong right now because of them. The list states what is owed. A new orphan
still fails.

The detector was wrong three times, and the third one is the one worth keeping.

It first counted a *comment* as an import: a docblock in `observe.ts` mentioning
`coach/emit.ts` made `emit.ts` look reached. That is A19 at the level of a matcher — the label of
a dependency with none of the substance. Then it could not see referrers outside `src/`, so it
called tailwind's design tokens an orphan; that one mattered because a gate which cries wolf on
correct code is one people learn to skip, and then a real orphan rides in behind the noise.

Then, having been taught to scan `scripts/`, it began scanning **itself** — and its own allowlist
is a list of module paths written as string literals, so every module in the list looked
referenced. `budgetVarianceAlignment` silently dropped off the report and the planted-orphan
self-test began passing when it should have failed.

The self-test caught it. Nothing else could have: the violation count went *down*, which reads as
things getting better. That is precisely the confident-empty-result this codebase has an
invariant against, and it happened inside the tool built to detect a related class, an hour after
I wrote the comment explaining why such a tool needs a self-test.

The gate is proven the way A38 requires — by a command, not an argument. A module nothing imports
was planted; the gate failed with exit 1 and named it. It was removed; the gate passed. Done
twice, the second time *after* the allowlist existed, because an allowlist is the most common way
a gate quietly starts passing unconditionally.

---

## Residual

```json
[
  { "id": "R1-the-coach-readout-reports-a-frozen-accept-rate",
    "item": "/api/admin/coach-readout and /api/brain/learning-summary read coach.suggestion_offered/accepted/dismissed. Nothing has emitted one since 2026-06-13. The surfaces show historical numbers with no indication the instrument stopped.",
    "why_skipped": "The June commit set the intended fix — retire emit.ts and the v3 readout TOGETHER — and retiring a live admin surface is a founder decision, not an implementation detail.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T15:50:00Z",
    "outcome": "OPENED and escalated rather than fixed. It looks low-stakes because it is an admin page few people open. The reason it may not be: it is the §4 readout, the instrument that answers 'is the coaching method working', and a frozen accept rate is worse than a missing one — a missing number prompts a question, a stale number gets quoted. The cheap interim, if the founder wants the readout kept, is one line on the response saying the v4 series ended in June. The real fix is the retirement the June commit already planned." },

  { "id": "R2-EmptyState-and-fetchJson-were-built-and-never-adopted",
    "item": "Two primitives, each written against a named failure class in this codebase, used by zero modules. EmptyState (first-run guidance, AMD-006 L3) and fetchJson (error-dressed-as-no-data, the class INVARIANT 22 polices).",
    "why_skipped": "Adopting either means touching many call sites across modules this session has no other reason to open, and doing that as a side-effect of an audit build is the churn §2's surface-don't-overtake warns about.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T15:51:00Z",
    "outcome": "OPENED. fetchJson is the more interesting of the two: the codebase has an INVARIANT policing a class that a primitive in the same tree was written to make impossible. A guard after the fact and a primitive nobody uses is strictly worse than either alone, because the guard's existence makes the gap feel handled. Worth noting that the four surfaces built today all handle !res.ok correctly by hand — which is the point: everyone re-implements it because the primitive is invisible." },

  { "id": "R3-the-gate-has-never-run-in-CI",
    "item": "Wired into npm run check and into ci.yml. Both were edited; neither has executed in CI.",
    "why_skipped": "Requires a push.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T15:52:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. It looks safe because the script was run locally many times and exits 0. The reason it may not be: CI runs from a clean checkout with no node_modules-warmed paths and a different working directory assumption, and the script does `existsSync('src')` and exits 2 if it is wrong about where it is. That failure mode is loud rather than silent, which is the right way round, but 'it works locally' is exactly the claim A38 exists to distrust." },

  { "id": "R4-reachability-is-file-level-not-export-level",
    "item": "The gate asks whether a MODULE is imported. It does not ask whether each exported symbol is used, so a file with one live export and six dead ones passes clean.",
    "why_skipped": "Per-symbol analysis needs a real TS program and import-graph resolution, not string matching — a different class of tool, and one whose false positives would be much harder to reason about.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T15:53:00Z",
    "outcome": "OPENED and the coverage boundary stated rather than implied, per A26. The three orphans that motivated this gate were all whole-module, so it catches the shape actually observed. What it would miss is the same rot one level down — aggregate.ts exports four functions and this build wired ONE of them (aggregatePitches); countPresentations, computeActivityKpis and sumTeamTotals remain uncalled inside a now-reachable file, and the gate is now green on them. That is a real miss, named here rather than discovered by the next sweep." },

  { "id": "R5-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried unchanged for the seventh build.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T15:54:00Z",
    "outcome": "OPENED. Unchanged, and still compounding." }
]
```
