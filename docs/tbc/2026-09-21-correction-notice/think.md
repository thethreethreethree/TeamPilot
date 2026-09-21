---
started_at: 2026-09-22T00:10:00+08:00
trigger: R2 of the override-surfaces closure. A manager corrects a score, the rep can read the correction and its reason on their own pitch detail, and nothing tells them it happened. They only find out if they reopen that pitch.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a changed number nobody mentions

## Why (the record)

The override build's own closure named this and rated it the lowest-confidence residual in the
file:

> *"This is the largest remaining hole in the loop and it undercuts the build's own premise: the
> reason overrides exist is that 'you're right' followed by an unchanged number teaches a rep that
> disputing is theatre. A changed number nobody mentions is a quieter version of the same lesson."*

It also named where it breaks worst, and that is the part that decides the design: the **proactive**
case. A manager listening back and correcting a pitch nobody disputed is exactly the correction a
rep would otherwise never learn about — there is no dispute thread for the reply to land in, and no
reason for the rep to reopen a pitch they were content with.

## What already exists, so I do not build a second one

The obvious build is a notification system. There is one.

`manager_notifications` (0242) is structurally generic: `company_id`, `recipient_id`, `agent_id`,
`type`, `payload`, `read_at`, with RLS granting `recipient_id = auth.uid()`. `NotificationBell`
reads whatever the caller is the recipient of. Only the table's NAME and its `type` CHECK are
manager-specific.

So a rep receives this through a bell they could always see and which had never had anything in it.
No new table, no second component, no parallel delivery path to keep in step with the first.

**Renaming the table** to match its contents is the tidier change and is deliberately not made. It
has run in production and is read by a route, a component and a realtime subscription — a large
blast radius for making a comment accurate. The honest alternative is to say so in the migration,
which is what it does.

## The decision that is not obvious: what a SECOND correction does

0242's unique index is `(recipient_id, type, session_id)` and its writer upserts with
`ignoreDuplicates` — a re-fire is a no-op. That is right for `strong_session`: a session is strong
once, and a retry must not notify twice.

It is wrong here. A manager can correct two items on one pitch minutes apart, and under
ignore-on-conflict the rep is told about the first and silently not about the second.

The options were a new row per correction (a pile of near-identical alerts for one pitch) or the
same row refreshed. Refreshed wins: one *"your score was corrected"* item per pitch that returns to
the top and returns to unread, carrying the latest total. Which means `created_at` and `read_at`
have to be written explicitly — `created_at` has a column default that only applies on INSERT, so
the conflict path would otherwise keep the first correction's timestamp and the alert would sort as
old news.

## What could go wrong, before I look

1. **The dedupe silently swallows the second correction** — one word in an options object.
2. **A failed notification fails the override**, which has already moved the score. The manager
   applies it again and a second override lands in an append-only log on a score already right.
3. **The alert is written in the manager's voice** — every other alert in this bell is a manager
   reading about somebody else, and reusing that voice produces "A rep made a correction" addressed
   to the person it happened to.
4. **A lost qualification goes unmentioned.** An override can cross the 40-base line downward, and
   the worst way to learn your pitch stopped counting is a leaderboard you quietly fell off.
5. **The link goes to the wrong screen.** "Pitch" names two entities in this product.

All five became tests. Four of the five became findings or near-misses, which is the first time
this session that the pre-written hypotheses have had that hit rate.

## Session-read manifest

```json
[
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-22T00:12:00Z",
    "why_it_governs": "Continuous adaptation the user cannot perceive is indistinguishable from stagnation; periodically surface evidence that the System knows more than it did.",
    "how_this_build_will_embody_it": "This build IS that clause applied to a single event. The system learned something — that its own score was wrong — and the person it learned it about could not perceive it. A correction nobody mentions is adaptation the user cannot see." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-22T00:13:00Z",
    "why_it_governs": "Guide, don't overtake; making the human a participant is what transfers capability instead of creating dependence.",
    "how_this_build_will_embody_it": "The alert is addressed to the rep in the second person and carries the manager's REASON, not just a number. A bare 'your score changed' would be the system informing them; the reason is what lets them disagree again." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-22T00:14:00Z",
    "why_it_governs": "Consume the verdict; never re-derive a decision from inputs an authority already judged.",
    "how_this_build_will_embody_it": "The item label comes from the rubric maps rather than being re-typed, and the qualifying flag comes from the recompute's verdict rather than being re-tested against 40. The alert states what the scorer decided, not a second opinion about it." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T00:15:00Z",
    "why_it_governs": "Layer 3: does the completed feature leave the user able to continue, or does it stall them?",
    "how_this_build_will_embody_it": "The override loop stalled at the rep's end. The alert links to the session page where the corrections section renders, so the rep lands on the explanation rather than on a screen that merely confirms a number changed." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T00:16:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Five hypotheses written before opening the bell. Four became real: the dedupe, the throwing notifier, the wrong link, and the voice. The fifth (lost qualification) became a clause in the copy." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-22T00:17:00Z",
    "why_it_governs": "Trace interconnections before committing; diagnose before patching.",
    "how_this_build_will_embody_it": "Tracing the upsert into the realtime subscription is what found F3 — the bell listened for INSERT, and a refreshed alert is an UPDATE. That is an interconnection two files apart with no type or test between them." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T00:18:00Z",
    "why_it_governs": "Append-only; entity state is derived by replaying events, never edited directly.",
    "how_this_build_will_embody_it": "Knowingly bent, and narrowly. The OVERRIDE log is append-only and untouched; the NOTIFICATION is a view of it that is updated in place. A notification is not evidence — the evidence is the override row — and treating an alert as an immutable event would give a rep five identical items for one pitch." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-22T00:19:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "Applied twice to mutation survivors. 'They are equivalent mutants' was the fast answer both times; one was true and proven with a control, two were not and exposed tests that could not fail." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-22T00:20:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2.",
    "how_this_build_will_embody_it": "The rubric's 'with the change logged' is what made the rep-visible log layer 2 in the previous build. Being TOLD is not in the rubric — it is my inference from the dispute loop's purpose, and is marked as such rather than claimed as specified." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T00:11:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The problem is not 'add a notification'. It is that the proactive correction — the one with no dispute thread to land in — is both the most valuable and the most invisible, and that is what rules out simply extending the dispute reply." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T00:21:00Z",
    "why_it_governs": "The governing methodology must be in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "0242's schema and its writer were both read before extending them, rather than reasoned about from the table's name — which is exactly what would have produced a second notifications table." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-22T00:22:00Z",
    "why_it_governs": "Retrospective Identification from the record.",
    "how_this_build_will_embody_it": "The record is the previous build's residual, which named this gap, rated it, and said where it breaks worst. The build is that entry acted on rather than re-derived." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-22T00:23:00Z",
    "why_it_governs": "Outside-Perspective Identification.",
    "how_this_build_will_embody_it": "The outside reading of ignore-on-conflict: it is not a bug in 0242, it is correct there. What is wrong is assuming a shared table implies shared semantics — which is what reusing the neighbouring writer would have done." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-22T00:24:00Z",
    "why_it_governs": "Holistic: never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "Widening the realtime filter to '*' echoes mark-all-read back as one extra re-fetch. Traced, stated at the call site, and accepted: it writes nothing and keeps the badge honest across two tabs." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-22T00:25:00Z",
    "why_it_governs": "External-config completeness.",
    "how_this_build_will_embody_it": "Binds lightly and is worth naming: realtime delivery depends on the table being in the Supabase publication, which is dashboard config this repo cannot hold. It was already required by the existing INSERT subscription, so this build adds no new external dependency — but it inherits one." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-22T00:26:00Z",
    "why_it_governs": "Ground-up auditing; a flag low down is leveraged more than one at the top.",
    "how_this_build_will_embody_it": "The CHECK constraint is the lowest layer here and the one that fails loudest — an unlisted type is rejected by Postgres rather than silently stored, which is why the type went into the constraint rather than being left as free text." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-22T00:27:00Z",
    "why_it_governs": "Measure downstream consequence, never agreement.",
    "how_this_build_will_embody_it": "Bears on what this data becomes. A correction notice is the system telling a rep it was wrong; the instrument worth building later is how often that happens and about what — not whether the rep acknowledged it." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-22T00:28:00Z",
    "why_it_governs": "Validated against the alternative, not asserted.",
    "how_this_build_will_embody_it": "19 mutations, and the two that mattered were caught only after the tests themselves were fixed. A suite that passes is not evidence; a suite that fails when the code is wrong is." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T00:29:00Z",
    "why_it_governs": "Item 0: founder decisions go through a picker.",
    "how_this_build_will_embody_it": "The founder listed the delivery choice (in-app, email, extension badge) as open. In-app was chosen without a picker because they directed the remaining items be finished; the reason is that in-app required no new mechanism, and email or a badge remain open on top of it." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T00:30:00Z",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is in a gate.",
    "how_this_build_will_embody_it": "F3 and F4 are both gated by tests that now fail on the defect. F4 in particular — a test that could not fail — is the failure A30 describes happening to a TEST rather than to code." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-22T00:31:00Z",
    "why_it_governs": "Schema-complete is not built; the seam between the database and the surface.",
    "how_this_build_will_embody_it": "Crossed in one build: CHECK constraint, writer, route wiring, bell copy, link. The previous build stopped at the data layer, which is the failure A31 names, and this one is the correction." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-22T00:32:00Z",
    "why_it_governs": "Verified is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the run with its exit code, states the mutation tally as n-of-n, and corrects two 'not verified' claims that this build made false." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-22T00:33:00Z",
    "why_it_governs": "A gate decision is returned as a verdict and consumed, never re-derived.",
    "how_this_build_will_embody_it": "The qualifying flag travels from the recompute into the payload into the copy without being re-tested against 40 anywhere. A re-derivation would be a third place the qualifying rule lives." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-22T00:34:00Z",
    "why_it_governs": "Migrations are safe-to-re-run by construction.",
    "how_this_build_will_embody_it": "0257 drops the constraint if it exists before adding it, and was confirmed re-runnable by the audit — 255 applied, 0 new non-re-runnable. The baseline is empty now, so a lapse here would have been the first entry back on the list." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T00:35:00Z",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "0242 was read rather than remembered, which is what made reuse possible instead of a second table. The standing exception is unchanged: the 2026-09-19 image still cannot be displayed." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-22T00:36:00Z",
    "why_it_governs": "Same-name-different-feature across modules.",
    "how_this_build_will_embody_it": "F1 is a small instance of it: 'pitch' names a Pitch Score pitch AND a Door Log pitch, and the first draft of the link sent a rep to the wrong feature's screen with the wrong kind of id." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-22T00:37:00Z",
    "why_it_governs": "Citing an asset without reading it is A19 undetected.",
    "how_this_build_will_embody_it": "This block, including the entries recording an asset as binding only lightly, which is the honest answer for §1.5.3 and §3.5 here." }
]
```
