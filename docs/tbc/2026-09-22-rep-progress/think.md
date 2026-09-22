---
started_at: 2026-09-22T11:05:00+08:00
trigger: The last named gap in the 2026-09-19 coaching build. Project 5's Patterns tab is live; its Rep progress tab has been "not built, and the screen says so" for three builds. Its board was opened at full resolution today and turned out to specify more than the earlier low-resolution read recorded.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — Rep progress, and a correction to my own evidence

## What opening the board at full size changed

The board was read once before at low resolution, and the EVIDENCE.md line for it records
"C8 on one page" — the manager's rep list reading "1 fixed · 1 improving · 2 open" for Anthony A.
while his panel reads "Open patterns 3".

**The numbers do not disagree, and the EVIDENCE.md line saying they do is wrong.** 1 improving +
2 open = 3, and the table underneath lists exactly three non-Fixed rows (Stalled, Improving, New).
The list *partitions* the open set; the panel *totals* it.

**C8 itself stands.** `LOGIC-AND-CONTRADICTIONS.md` states it precisely and I had not re-read it
either: the finding is that the WORD "open" carries two senses on one page — "both total correctly
in their own frame" is its own wording. That is a real vocabulary defect and the founder ruled on
it; it is not the claim that a count is wrong.

So the error is narrower than it first looked and more embarrassing for it: I took a subtle,
correctly-recorded finding about a word, restated it from a small image as a contradiction in the
founder's arithmetic, and propagated the restatement. **A summary of a summary, twice removed from
the render.** A21's lesson is about names; this is the same failure at the level of pixels, and R2
is the rule it broke — a summary never discharges its source. Corrected in EVIDENCE.md and in
`PatternInterrupt.tsx`'s header rather than left to propagate.

## The plan, from the render

Five team cards, a rep list, and a rep panel.

**Cards.** OPEN PATTERNS 12 "Across 5 reps" · FIXED THIS MONTH 6 "Avg 9.5 days to fix" · STALLED 2
"Coached 7+ days, no change" · AWAITING REP REVIEW 1 "Coached, clips not opened" · POINTS RECOVERED
+10.0 "Per pitch, team total".

**Rep list**, ordered "NEEDS ATTENTION FIRST": name, a pill (Needs 1:1 / Follow up / New rep / On
track), a three-segment bar, and "N fixed · N improving · N open".

**Rep panel.** Five tiles (Open patterns / Fixed / Avg days to fix / Points recovered / Rep
reviewed "2/2 Coached patterns acknowledged"), an alert box with a `Stalled:` line and a
`Waiting on you:` line, a September timeline with Ⓒ Ⓓ Ⓡ markers, the "Where each pattern stands"
table, a NEXT CHECK-IN AGENDA card with Schedule check-in / Open clips, and a FIXED PATTERNS card.

## What already exists, checked rather than assumed

Sixth build in a row where this section comes before the design.

- `statusOf()` returns `{status, open, reason, streak}` — the single author of "open", by the
  founder's C8 ruling. Nothing here re-derives it.
- `countPatterns()` already returns `open` AND `openNotImproving`. The board needs both, one per
  column of the same row. That is not a coincidence; it is the ruling paying for itself.
- `detectPattern()` returns `{misses, applicable, strip, costPerPitch}` — `costPerPitch` is
  "POINTS RECOVERED", already computed.
- `firstSeenAt` / `fixed_at` on `patterns` (0258) — "OPEN 9 days" and "took 9 days" are both
  subtractions of columns that exist.
- `pattern_events` with the guide's six kinds verbatim, including `coached`, `drill_assigned` and
  `rep_reviewed` — the three the timeline legend draws and the two the table's last two columns
  need. These were the kinds the low-resolution read missed and the full-size read found.
- `COMPARISON_WINDOW = 5` — the table prints `3/5 → 3/5` and `4/5 → 1/5`, so the window is
  confirmed by the render rather than assumed from the guide.
- `CLEAN_STREAK_TO_FIX = 5` — "0 of 5" and "2 of 5" under the clean-streak dashes. Also confirmed.

**Missing: no new table.** Every column on this board is derivable from `patterns`,
`pattern_events` and `pitch_score_elements`. The first build in this cycle that needs no migration.

## What could go wrong, before I look

1. **A second definition of "needs attention".** The rep list is ORDERED by it and PILLED by it,
   and nothing in the guide defines it. Whatever I choose becomes a judgement the product makes
   about a person, printed next to their name. It must be derived from the statuses that already
   exist, not invented, and it must be visible to the rep it describes (A10) or it is a shadow
   judgement.
2. **"Avg days to fix" over zero fixed patterns.** A new rep has none. The tile must say so rather
   than print 0.0, which reads as "fixes instantly".
3. **A timeline that implies precision it does not have.** The bars run to "Today" and the markers
   sit on event dates. An event with no date, or a pattern first seen before the window, has to
   clamp visibly rather than silently.
4. **"Rep reviewed 2/2" with no rep-review path.** `rep_reviewed` is a `pattern_events` kind and
   nothing writes it. A tile reading 0/3 forever is a metric about a feature that does not exist.
   Either the rep can acknowledge, or the tile says the acknowledgement is not wired.
5. **The agenda card is generated advice.** Three numbered coaching instructions about a named
   person. §3.4 says the system has no fixed day-one behaviour and §3.3 says it asks before it
   asserts. Generated prose here is the most §3.3-exposed thing on the board.
6. **"Open clips" points at Project 4.** Now buildable, and the wrong link is worse than none.
7. **Four surfaces will now render a pattern's status.** Patterns tab, rep board, this table, and
   this timeline. One resolver or they drift (§2.2).

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T11:06:00+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The board was opened at full resolution BEFORE designing, and doing so overturned a finding I had already recorded about it twice. The understanding was not earned the first time; the confidence was." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T11:06:30+08:00",
    "why_it_governs": "Methodology in the tree, consulted at the moment of action.",
    "how_this_build_will_embody_it": "The board is in the tree and was read from the render, not from EVIDENCE.md's line about it — which is exactly the summary-discharging-its-source failure the evidence protocol names." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "78-84", "read_at": "2026-09-22T11:07:00+08:00",
    "why_it_governs": "Holistic — trace the ripple before changing shared state.",
    "how_this_build_will_embody_it": "Four surfaces will render a pattern's status once this ships. The ripple is that `statusOf` becomes load-bearing for all four, so any change to it now moves four screens at once." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T11:07:30+08:00",
    "why_it_governs": "Four layers, foundation up; layer 3 asks whether the user can continue.",
    "how_this_build_will_embody_it": "The agenda card IS layer 3 made explicit: it exists to tell a manager what to do next. Its two buttons are the continuation, and 'Open clips' must actually reach the player built this morning or the card stalls exactly where it promises to help." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T11:08:00+08:00",
    "why_it_governs": "THINK first about what could fail, then search.",
    "how_this_build_will_embody_it": "Seven hypotheses before writing. The two that shape the build are the undefined 'needs attention' rule and the rep_reviewed tile measuring a path nothing writes." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "187-209", "read_at": "2026-09-22T11:08:30+08:00",
    "why_it_governs": "A user-specified experience is layer-2, not waivable layer-4 polish.",
    "how_this_build_will_embody_it": "The founder's instruction is to build true to this folder. The timeline, the three-segment bars and the dash strips are specified BY THE RENDER, so they are the intended result and not decoration to defer." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-334", "read_at": "2026-09-22T11:09:00+08:00",
    "why_it_governs": "Consume the verdict; never re-derive the gate.",
    "how_this_build_will_embody_it": "`statusOf` and `countPatterns` are the authorities and this board consumes both. The rep list's 'N fixed · N improving · N open' is a partition of one resolver's answer, not three independent filters — three filters is how the two numbers on one screen come to disagree." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T11:09:30+08:00",
    "why_it_governs": "Append-only; state derived by replaying events.",
    "how_this_build_will_embody_it": "The timeline IS the event log rendered. Every marker is a `pattern_events` row and every bar is bounded by `first_seen` and `fixed_at`; nothing on it is stored as a summary." },

  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-363", "read_at": "2026-09-22T11:10:00+08:00",
    "why_it_governs": "Guide, don't overtake; ask the human what they think first.",
    "how_this_build_will_embody_it": "The most exposed thing on this board. NEXT CHECK-IN AGENDA is three numbered instructions about a named person. Built as a derivation from what is on the record — replay this clip, this streak is at 2, this one has never been coached — never as generated advice, and phrased so a manager edits it rather than performs it." },

  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-09-22T11:10:30+08:00",
    "why_it_governs": "No instant results; month 1 is a control with guidance off.",
    "how_this_build_will_embody_it": "The agenda is the one element here that is arguably guidance rather than a mirror. It goes through the same control gate as the rest of the guidance layer, consumed as a verdict — not re-derived here, which is the A40 shape that produced the empty-AI outage." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "404-418", "read_at": "2026-09-22T11:11:00+08:00",
    "why_it_governs": "Knowledge is not intelligence; distrust the confident answer that arrived quickly.",
    "how_this_build_will_embody_it": "The C8 correction above is this clause exactly. A fast confident read of a small image produced a finding about the founder's own work that survived into three documents before anyone looked again." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T11:11:30+08:00",
    "why_it_governs": "The pre-action checklist.",
    "how_this_build_will_embody_it": "Item 5a: the manager's workflow here ends at a button. Schedule check-in and Open clips both have to land somewhere real or the agenda is a list of things they cannot do." },

  { "id": "A10", "source_file": "ThinkerThinker.md", "line_range": "260-274", "read_at": "2026-09-22T11:12:00+08:00",
    "why_it_governs": "The user sees what the system sees about them; no shadow read.",
    "how_this_build_will_embody_it": "Binding on the pills. 'Needs 1:1' and 'New rep' are judgements printed beside a person's name on a screen they cannot open. Either the rep can see their own standing, or the pill is a shadow judgement — and a rep discovering it secondhand is worse than the pill not existing." },

  { "id": "A11", "source_file": "ThinkerThinker.md", "line_range": "275-292", "read_at": "2026-09-22T11:12:30+08:00",
    "why_it_governs": "The system mirrors; it does not judge.",
    "how_this_build_will_embody_it": "'Needs attention' must be a SORT over facts the rep can check — stalled patterns, days uncoached — never a score. A mirror says 'two of these have been open a week'; a judge says 'this person needs a 1:1'." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-593", "read_at": "2026-09-22T11:13:00+08:00",
    "why_it_governs": "Same name, different feature, across modules.",
    "how_this_build_will_embody_it": "Checked before writing: `repProgress` does not exist, and `RepRow` is ALREADY TAKEN by the Coach Assessment board meaning something else entirely. This build's row type is named for this board. Today already produced a worse instance of this class — a route overwritten rather than a name reused." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-644", "read_at": "2026-09-22T11:13:30+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "The manifest gate caught two cited-but-unread ids in the last build (A12 and §1.5.3) and reading them changed what I wrote about both. Cited here only what was opened today." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T11:14:00+08:00",
    "why_it_governs": "Gate the class; a gate must be precise or not exist.",
    "how_this_build_will_embody_it": "Applied to the derivations: 'avg days to fix' over an empty set must be a null the type system forces a surface to handle, not a 0 that renders as instant." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-819", "read_at": "2026-09-22T11:14:30+08:00",
    "why_it_governs": "Schema-complete is not built.",
    "how_this_build_will_embody_it": "Hypothesis 4 is this: `rep_reviewed` is a valid event kind that nothing writes. A '2/2 acknowledged' tile over a path with no writer is a number about a feature that does not exist, and it will read as working." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-22T11:15:00+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code on its own line, never off a pipeline tail." },

  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1060-1090", "read_at": "2026-09-22T11:15:30+08:00",
    "why_it_governs": "Consume the verdict, don't re-derive the gate — the account-based empty-AI outage.",
    "how_this_build_will_embody_it": "Directly binding on the agenda card: it is guidance, the control gate decides whether guidance runs, and a second copy of that condition here is precisely the dropped-exemption shape that discarded a real answer for every guidance-off account." }
]
```
