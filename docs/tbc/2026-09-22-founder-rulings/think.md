---
started_at: 2026-09-22T11:45:00+08:00
trigger: Three founder rulings taken in one picker after the pattern-actions build named them — the coaching bell, the drill button's verb, and whether "a table with no writer" becomes a gate.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — three rulings

## What was decided

| Question | Ruling |
|---|---|
| A coaching note rings no bell; AWAITING REP REVIEW counts reps who were never told | **Pattern-scoped bell** — a migration adding a dedupe key that fits |
| "Assign Role Play drill" records an assignment and creates no drill | **Wire it to Role Play** so the drill appears |
| Should read-without-writer become a gate? | **"create a precise rule"** — none of my three options |

The third answer is the interesting one. I offered "not yet", "add it now and allowlist the
noise", and "audit once without enforcing". The founder took none of them and asked for the thing
I had said I did not have: **a precise rule.**

That is the right correction. "I do not yet have a precise rule" is a description of my position,
not an argument against the gate — and offering three ways to work around the missing rule
instead of writing it is the §5 shortcut dressed as caution. Caution that produces no artefact is
the same evasion as haste that produces a bad one.

## Ruling 1 — why a bell needed a migration

0242's dedupe key is `(recipient_id, type, session_id)` and every notification writer since has
upserted against it. **A pattern has no session.** With `session_id` null Postgres treats every
row as distinct, so three notes in one sitting would ring three bells.

The design question was where the new key lives. A `payload->>'pattern_id'` expression index
would avoid a column and make the constraint invisible to anyone reading the table — and the
thing being enforced is exactly the sort that gets quietly lost. A column also gets a foreign
key, so a deleted pattern takes its notifications with it.

**The trap to avoid:** a partial `where pattern_id is not null` index is tidier and would break
at runtime. PostgREST's `on_conflict` emits the column list and no predicate, so Postgres cannot
infer a partial index — green types, green tests, a 500 the first time a manager writes a note. A
plain unique index is inferrable, and null-distinctness already keeps the session types apart.

## Ruling 2 — what "wire it to Role Play" can mean without a new table

Role Play already takes `?focus=<skill>`: the prospect creates moments for it and the end review
scores it. So the assignment does not need a queue — it needs the `drill_assigned` event to
become a seeded link on the rep's side. A queue table would be a second record of something
`pattern_events` already holds (§3.1).

## Ruling 3 — what makes the rule precise

The naive rule ("every table read has an insert in `src/`") fires on every lookup table, every
migration-seeded config and every trigger-filled table. Forty findings on the first run get
allowlisted into silence within a week, and then the gate is worse than nothing because it looks
like coverage (A30).

So a writer must be **any of**: application code that writes it; an INSERT in a migration; an
INSERT or UPDATE inside a function or trigger body; or an allowlist entry with a reason. Views
are exempt because they are not writable.

**Two things decide whether this is precise, and both are measurable rather than arguable:**

1. **Run it against all 153 tables and count the false positives.** If the first run needs more
   than a handful of allowlist entries, the rule is wrong and I should say so rather than pad the
   list.
2. **Plant a probe.** Remove the writer I shipped an hour ago and confirm the audit names
   `pattern_events`. An emptied finding list and a broken gate look identical — this codebase has
   shipped a gate whose regex could never match, and re-proved the migration audit with exactly
   this technique.

## What could go wrong, before I look

1. **The `.from("x").method()` regex missing a wrapped chain**, so a real writer reads as absent.
   A false positive here is what kills the gate.
2. **SQL comments describing an insert** — the 0022 lesson. Migration headers in this repo
   routinely quote the statements they describe.
3. **A test counted as a writer**, which would pass the audit on a table whose only insert is a
   fixture — the failure it exists to catch, dressed as coverage.
4. **Tables with no reader either.** Out of scope deliberately: dead weight is a different
   finding from a surface that renders empty, and conflating them grows the allowlist.
5. **The notification type CHECK** — A34: a writer for a type the CHECK has not learned is a 500
   after the row is written.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T11:46:00+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The rule is measured before it is called precise: run against 153 tables, count the findings, then plant a probe to prove it can still fail." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "78-84", "read_at": "2026-09-22T11:46:30+08:00",
    "why_it_governs": "Trace the ripple.",
    "how_this_build_will_embody_it": "A new entry in `npm run check` runs on every build from now on; a false positive costs every future build, which is why the false-positive count is the acceptance test rather than a footnote." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-334", "read_at": "2026-09-22T11:47:00+08:00",
    "why_it_governs": "Consume the verdict; never re-derive.",
    "how_this_build_will_embody_it": "The notification payload's pattern label comes from `describeItem`, exported from the read layer rather than re-formatted in the route — a bell naming a pattern differently from the board it links to is two authors for one label." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T11:47:30+08:00",
    "why_it_governs": "Append-only; state derived by replaying.",
    "how_this_build_will_embody_it": "The drill assignment is the `drill_assigned` event turned into a link, not a queue row. A queue table would be a second record of a fact the log already holds." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "404-418", "read_at": "2026-09-22T11:48:00+08:00",
    "why_it_governs": "The biggest risk is the builder under pressure; the temptation is to make it less honest for a faster result.",
    "how_this_build_will_embody_it": "Directly earned. I offered three ways around writing the rule instead of writing it, and the founder declined all three." },

  { "id": "A10", "source_file": "ThinkerThinker.md", "line_range": "260-274", "read_at": "2026-09-22T11:48:30+08:00",
    "why_it_governs": "The user sees what the system sees about them.",
    "how_this_build_will_embody_it": "The bell is the push half of the banner's promise. It fires only for a MANAGER's action and never for the rep's own events — notifying someone about themselves is A10 inverted." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T11:58:00+08:00",
    "why_it_governs": "Methodology that governs the build must live in the working tree AND be read in session — labels propagate through commits far faster than content propagates through an external store, so citing a label without reading it gives false confidence the discipline is being applied.",
    "how_this_build_will_embody_it": "Re-read because the manifest gate demanded it, and the reading changed this entry: A19's closing line is the one that bites here — 'keeping a methodology document outside the working tree is the same shape of mistake, the next author does not search the user's hard drive before substantive action.' The writer audit is that lesson pointed at a TABLE: 0258's closure flagged the missing writer, and a flag in a closure is the same kind of store nobody searches." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-22T11:58:30+08:00",
    "why_it_governs": "Citations without session-reading are A19 + A9 violations operating undetected; the founder caught an agent citing eleven sections it had not opened.",
    "how_this_build_will_embody_it": "The commit-msg hook and this manifest gate are A22 made structural, and both fired on me today — once for A12 and §1.5.3 in the recordings build, once here for A19, A22 and A30. Each time the reading changed the entry rather than confirming it, which is the argument for the gate existing." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T11:49:00+08:00",
    "why_it_governs": "Gate the class; a gate must be precise or not exist, and keep it quiet.",
    "how_this_build_will_embody_it": "The whole of ruling 3. Precision is the acceptance criterion, measured as the first-run finding count, and the four writer categories exist so the quiet case stays quiet." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-819", "read_at": "2026-09-22T11:49:30+08:00",
    "why_it_governs": "Schema-complete is not built.",
    "how_this_build_will_embody_it": "This build turns A31 from a lesson in prose into a command that exits non-zero — which is what A30 says has to happen to a lesson if it is to stop recurring." },

  { "id": "A34", "source_file": "ThinkerThinker.md", "line_range": "880-905", "read_at": "2026-09-22T11:50:00+08:00",
    "why_it_governs": "Code hard-requiring an unapplied migration must degrade.",
    "how_this_build_will_embody_it": "0262 extends the type CHECK and the writer is best-effort, so a deploy that races the migration rings no bell rather than losing the coaching." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-22T11:50:30+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code on its own line, and the new audit is itself mutation-tested so its green is worth reading." }
]
```
