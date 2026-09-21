# CLOSURE — a score a rep cannot contest is a verdict, not coaching

Two things were missing and only one of them was on the list.

The one on the list was the screen. The previous build ended with a route returning JSON that
nothing consumed — curl could score a pitch, a rep could not. That is fixed: the Pitch Score now
sits on the session page beside the existing review, and every point on it opens to the grade, the
evidence, and the moment in the recording.

The one that was not on the list was found by reading back what had already shipped this session.
`ScoringRubricSheet` went out carrying the rubric's own competition rules, and the last of them
reads: *"A pitch never scores below 0. Think a score is wrong? Tap Dispute on the pitch."* That
text was live in the product. There was no Dispute. No control, no route, no event — the product
was instructing reps to do something that did not exist.

That is §1.5.1 layer 3 in its sharpest form, and worse than the usual version, because the dead
end was not inherited from somewhere else. The feature created it, in its own copy, the same day.
So the dispute was built rather than filed: a route that appends an event, a form that says what
it does, and controls on the screen that produce it.

It appends and writes no points, and the reasoning matters more than the code. A score a rep
cannot contest is not a coaching tool, it is a verdict — and the entire scoring design, the
evidence on every element, the timestamp on every claim, the confidence kept on a bonus that was
heard and not awarded, only pays for itself if there is somewhere to point at it. But a dispute
that moved the number would let a rep edit their own leaderboard position by complaining, which
would make the leaderboard a measure of who objects loudest. §3.5 has a name for measuring that
instead of the consequence. So the form says, in as many words, that filing does not change the
score, and the route writes nothing but an event.

The design was opened rather than remembered. Page 3 of the rep dashboard was rendered and
described before a single styling decision — the near-black ground, the yellow score, the green
HIT and amber PARTIAL badges, the outlined play chips, the red-tinted violations card, the
outlined Dispute button at the foot.

Which surfaced a contradiction worth stating rather than quietly resolving. This app's palette is
deliberately mono-amber; `globals.css` sets `--error: #854D0E` and comments it *"burnt amber, no
red"*, and `--success` is yellow. The specified design uses green and red. Rather than obeying
either side from memory, the audit script was read: it flags only **pale** tints, because those
hold on dark and disappear on light. Saturated green and red are not leaks. So the rule is
narrower than it looked from either direction — mono-amber governs the app's chrome, and does not
forbid colour used as data. The grade colours stayed, because the founder specified them and
§1.5.4 makes a specified experience the result rather than deferrable polish. They are never the
only channel: every badge carries the word as well, because a red-green distinction is invisible
to roughly one man in twelve and the grade is the entire point of the row.

Three things were caught by looking rather than by a test.

`bg-brand-fill` was a token I invented. Tailwind does not define it, so the primary "Score this
pitch" button would have rendered with no background — pale text on nothing. It reads exactly like
this codebase's vocabulary, which is why it survived writing and typechecking; it was caught by
counting real usages, and `bg-ember-400` had 110 while `bg-brand-fill` had two, both mine.

A mutation run lied. P5b reported the per-item Dispute link as covered when it was not: the
six-space anchor string was a substring of the sixteen-space occurrence, so the replacement landed
on the wrong control. Re-run against exact anchors, the footer button was tested and the per-item
link was not — the same dead-control defect one layer down. A mutation that does not apply where
you think reports as "caught", which is the technique's own failure mode and is now on the record.

And `build:ci` failed. The fast move was to note that `/dashboard/meeting-coach/prep` is in another
feature area nothing here touches, call it unrelated, and move on. That is reasoning, not a
measurement. HEAD was built in a clean worktree with no working-tree changes: 381 pages, same page,
same error. **`main` is red on the secretless build right now**, which is what CI's Build step
runs. That is a finding about the repository rather than a defence of this build, and it is the
next thing to fix — with one real cost to this build, stated plainly: the export halts at the first
bad page, so no production build has rendered this UI, and none can until main is green.

---

## Residual

```json
[
  { "id": "R1-disputes-append-into-a-queue-nobody-reads",
    "item": "coach.pitch_score_disputed events are written and no surface reads them. A rep files a dispute, is told their manager will see it, and no manager has anywhere to see it.",
    "why_skipped": "The manager side is the Coach Assessment rebuild (Project 3 in the guide) and needs its own decisions — where the queue lives, whether a manager can override a grade, and what an override does to a leaderboard that is already published.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T13:40:00Z",
    "outcome": "OPENED, and it is the same defect this build was written to fix, displaced by one step rather than removed. Before, the product told reps to tap a button that did not exist; now it tells them a manager will see something no manager can see. The difference is real — the event is durable, so nothing is lost and the queue will be there the moment a surface reads it — but the sentence shown to the rep is ahead of the system again, and that is exactly how the first gap was created. The cheap interim is to soften the confirmation copy to what is actually true. The right fix is the manager queue." },

  { "id": "R2-play-chips-have-never-played-anything",
    "item": "onSeek is threaded through PitchDetail and PitchScorePanel and nothing passes it, so every timestamp renders as plain text. The evidence says WHEN and cannot take you there.",
    "why_skipped": "Wiring it means an audio element on the session page with a seekable source, and the pitch's audio_url is a storage path whose signing and playback belong with the Recordings tab (Project 4).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T13:41:00Z",
    "outcome": "OPENED. It degrades honestly rather than breaking — a time as plain text is a true statement, and a dead play button would not be — so the screen is not lying. But the timestamp is half the value of the evidence: 'Wobbled on price at 3:20' is a claim a rep can check only if they can get to 3:20. Until then the rep has to scrub a transcript by hand, which most will not do, which means the evidence is read as an assertion rather than as proof." },

  { "id": "R3-main-is-red-on-the-secretless-build",
    "item": "npm run build:ci fails prerendering /dashboard/meeting-coach/prep on a missing NEXT_PUBLIC_SUPABASE_URL. Reproduced at HEAD in a clean worktree, so it predates this build and CI's Build step is failing on main now.",
    "why_skipped": "Diagnosed but not fixed in this build — the fix belongs in its own commit rather than buried inside a feature, and it is somebody else's page.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T13:42:00Z",
    "outcome": "OPENED as the immediate next build. The shape is known: the page reaches a browser Supabase client during prerender, and that client throws by design when env is absent. This is A38's own territory — it was only found because build:ci was run by name instead of a self-chosen subset, and it has been red long enough that at least one session shipped without running it. The second-order cost is the one to watch: while main is red, nobody's UI can be proven to build, including this build's." },

  { "id": "R4-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried forward unchanged for the third build. Guide page 2 names it as holding Project 1's full scoring detail; it has never been read.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T13:43:00Z",
    "outcome": "OPENED and compounding. Three builds have now each added decisions the document may already have made — six in the scorer, the trigger in the route, and now the dispute's shape (append-only, no re-score, manager reviews). Every one is defensible and every one is a place the document could disagree. The §0.1 precondition has been unmet for the whole of Project 1." },

  { "id": "R5-the-instruction-image-resolutions-are-still-unconfirmed",
    "item": "B1 (Pitch detail is a web surface, page 4 is a sheet) and B2 (apply the new navigation in full) rest on an image the API rejected and never displayed, which was nonetheless described and acted upon.",
    "why_skipped": "Needs the founder to re-send it smaller or state the instruction in text.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T13:44:00Z",
    "outcome": "OPENED, and this build is the first to DEPEND on B1 rather than merely record it — the Pitch Score panel was placed on the web session page, which is B1's reading. It also mitigates it: the panel is a self-contained component gated by one conditional, so if B1 is wrong and the detail belongs on mobile only, the fix is to move one JSX block, not to rebuild the surface. Recorded so the dependency is visible rather than inherited silently." }
]
```
