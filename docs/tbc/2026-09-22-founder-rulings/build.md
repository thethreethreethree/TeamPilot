# BUILD — three rulings

## 1. The pattern-scoped bell

**Migration 0262.** A `pattern_id` column on `manager_notifications`, a second unique index over
`(recipient_id, type, pattern_id)`, and `pattern_coached` added to the type CHECK. Applied through
the ledger; DB at 0262; 30 invariants hold; re-run finds nothing pending.

Two decisions inside it worth their comments:

**Not partial.** `where pattern_id is not null` would be tidier and would break at runtime —
PostgREST's `on_conflict` emits a column list and no predicate, so Postgres cannot infer a partial
index. Green types, green tests, a 500 the first time a manager writes a note. A plain unique
index is inferrable, and null-distinctness already keeps the session-scoped types on their own
key. Nothing about the existing five types changes.

**One type for three actions.** `coached`, `drill_assigned` and `note` all mean *your manager said
something about this pattern* and land on the same screen. Three types would put three rows in one
bell for one conversation. The payload carries which action it was.

**Who it fires for.** A manager's action, on someone else's pattern. Not `fixed` — a closed
pattern is good news the rep meets on their own board, and "your manager closed something about
you" reads as a verdict. Not the rep's own events: notifying someone about themselves is A10
inverted. Not a manager about their own pattern.

The label in the payload comes from `describeItem`, now exported from `readPatterns` rather than
re-formatted in the route. A bell naming a pattern differently from the board it links to is two
authors for one label (§2.2).

## 2. The drill that appears

Role Play already takes `?focus=<skill>` and drives the whole drill from it — the prospect creates
moments for that skill and the end review scores it. So the assignment needed no queue table: the
`drill_assigned` event becomes a seeded link on the rep's side.

- **Rep:** an amber panel, *"Your manager assigned a drill"*, with **Start the drill** →
  `/roleplay?focus=<this pattern's label>`, and the date it was assigned.
- **Manager:** a line confirming the drill is reachable and where — which is the half of "assign"
  that was missing.

A queue table would have been a second record of a fact `pattern_events` already holds (§3.1),
and it would have needed its own writer, its own RLS and its own audit entry to say the same
thing.

## 3. The precise rule — `scripts/writer-audit.mjs`

> A table that application code READS must have at least one writer.

A writer is any of:

| | |
|---|---|
| (a) | application code that inserts / upserts / updates / deletes it |
| (b) | an INSERT in a migration — seed or reference data |
| (c) | an INSERT or UPDATE inside a function or trigger body |
| (d) | an allowlist entry giving the reason it legitimately has none |

Views are exempt: not writable, and their backing tables are audited on their own.

**(b) and (c) are not concessions — they are the rule being correct.** A table a migration seeds
has a writer; so does one a trigger fills. Without them the first run produces forty findings, the
allowlist absorbs them within a week, and the gate becomes coverage-shaped noise (A30).

### The measurement, which is what makes it precise rather than plausible

```
Tables defined:        153
Views (exempt):         60
Tables read by src:    158
Tables written by src: 117
Written by SQL only:    30
```

**First run: one finding.** `smoke_test_versions` — read by two routes, written by nothing in
`src/` or SQL. Investigated rather than allowlisted on sight: it is written over the REST API by
`scripts/update-smoke-test-comprehensive.mjs` and
`scripts/smoke-test-add-structural-and-spawn.mjs`. A table only an operator script fills is a real
category — admin-curated reference data — so it is allowlisted with those two scripts named, which
makes the claim checkable instead of asserted.

One finding across 153 tables, and it was true. That is the number that earns the word "precise".

### The probe

An emptied finding list and a broken gate look identical, so the writer I shipped an hour ago was
removed and the audit re-run:

```
✗ 1 table(s) read by the product that NOTHING writes:
  • pattern_events
      read by src\lib\coach\patterns\readPatterns.ts
```

It names the exact table and the exact reader that were invisible for three builds while every
test passed. Restored; back to green.

### Wired in

`npm run check` now runs `writer:audit` between `reachability:audit` and `migration:audit` —
deliberately beside the other question about whether code and schema are actually connected to
anything.

## 4. The defect the new gate found that it cannot itself catch

Wiring the bell meant opening `NotificationBell.tsx`, which knew exactly three notification
types. **I had shipped two more that morning** — `recording_comment` and
`recording_share_requested` (0261) — and was adding a third.

Each had a migration, a CHECK entry, a writer, tests and a reason. Each would have arrived at the
bell and fallen through `text()` to the final branch, rendering **"A rep closed a deal"** to a rep
about a coaching note on their own pitch. The row written, the bell rung, the sentence wrong.

It is the same family as `pattern_events` one level down: not a table with no writer, but a
**value in a closed set that no surface renders**. `writer:audit` cannot see it — the table has
117 writers. So the defence is different in kind: `text()` now ends in `assertNever(n.type)`, and
the union matches the CHECK constraint. A new type added to the database and not to this file is
a **compile error**, not a wrong sentence in someone's bell.

Two other things the reading fixed:

- **The icon.** The three new types are addressed to the rep, and the existing
  `pitch_score_corrected` branch had already chosen a token-coloured dot over a glyph for a stated
  LAW-1 reason: placing a mark nobody has opened and looked at is what that rule forbids. They
  join that branch rather than each acquiring an unexamined icon.
- **The link.** `pattern_coached` has no `session_id` — a pattern spans many sessions — so under
  the old session-shaped default it would have rendered as an unclickable row. Each type now names
  its own destination, and a missing id gives no link rather than a wrong one.

## What this turns A31 into

A31 has been a lesson in prose since June: *schema-complete is not built.* It was written down,
cited in four think.md files this cycle, and did not prevent `pattern_events` sitting unwritten
under five surfaces for three builds. A30's point is exactly that — a lesson in prose returns; the
fix is to gate the class.

It is now a command that exits non-zero.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build.

---

## Addendum — the enum ruling, and a rule I had to abandon before finding one

> Founder ruling: *"build it, measured first"*, over my "not yet" and "allowlist the noise".
> Plus: `clip_disputed` now, not bundled.

### `clip_disputed` reaches a manager — 0263

The one alert in this product that points **back**. Every notification added today points at the
rep: a correction, a comment, a share request, a coaching note. This is the rep saying the scorer
is wrong about a specific moment, and it is the only channel that exists for that.

Recipient resolution is 0242's, not a second copy — no per-agent manager FK exists, so a manager
is any company admin or sales-coach admin and the alert fans out. Its own type rather than reusing
`pattern_coached`, because one pattern can carry a rep's dispute AND a manager's coaching at once
and they go to different people; sharing a type would collide on `(recipient_id, type, pattern_id)`
and silently overwrite. The dedupe key from 0262 is reused as-is.

### The enum rule: four measured failures before a rule worth shipping

The obvious rule is *"if the code knows SOME values of a CHECK set it must know ALL of them"*,
inferred from string literals. Built and measured against all 99 sets in the schema. Every version
produced false positives from a **different** cause:

| | rule | findings | why they were wrong |
|---|---|---|---|
| v1 | any literal anywhere | 9 | `"lost"` belongs to the pivot-direction enum, not `coaching_sessions.outcome`; and a 3-character floor missed `"ai"` in `support_messages.author_type`, reporting it absent while it was handled two lines away |
| v2 | site = a file with 2+ values | 6 | English is small — "sent"/"failed" collide across features |
| v3 | + the site must name its table | 4 | |
| v4 | + comments stripped | 3 | a docstring listing a set is the likeliest place for its values to appear together |
| alt | a TS union overlapping a set | 59 | colour names and status words, everywhere |

**All three of v4's survivors were verified by hand and all three were correct code**: routes that
TRANSITION a subset of a state machine (`draft → submitted`, "mark it ignored") or validate one
("fail and unable need a note; pass does not"). A route that writes part of a state machine
legitimately names part of it.

That is not a bug to allowlist. It is the rule being wrong, and wrong in a way that **gets worse**:
every future transition route would fire it. A gate whose false-positive rate grows with ordinary
development is allowlisted into silence by construction, and then it looks like coverage. I said in
the picker that if the rule turned out wrong I would say so rather than pad a list, so: it was
wrong, and this is me saying so.

### What replaced it

Inference cannot tell *"mirrors this column"* from *"shares two ordinary words with it"*.
**Declaration can.**

```ts
// enum-source: manager_notifications.type
type: "strong_session" | "deal_closed" | … ;
```

The audit requires a declared mirror to contain **exactly** its CHECK set — no missing value, no
invented one. Zero false positives by construction, because nothing is audited that has not opted
in. Zero cost where unused. And the contract sits at the one place a human decided the two things
are the same list.

**The invented-value half matters too**, and is less obvious: a union member the database cannot
produce is dead code that reads as a handled case, and it is what survives when a later migration
*narrows* a CHECK.

### The bug the build found in its own parser

First run reported the bell's four correctly-handled values as **NOT IN THE DATABASE**. The parser
was line-by-line: 0242 writes its list on one line, and every extension since — 0257, 0261, 0262,
0263 — formats one value per line. It saw the old form and none of the new ones, called
`manager_notifications.type` a two-value set, and was confidently wrong about the exact table the
audit was built for.

Fixed by matching on the whole file with `[\s\S]` and attributing each constraint to the nearest
preceding table statement by position. **The set count went from 99 to 104** — five sets had been
entirely invisible.

### Proved, not asserted

Probe: revert the bell's union to this morning's three values.

```
✗ 1 mirror(s) out of step with the database:
  • manager_notifications.type   src\components\sales-coach\NotificationBell.tsx:41
      MISSING: recording_comment, recording_share_requested, pattern_coached, pattern_clip_disputed
```

Six mutants on the audit; one survived — the SQL comment-strip — because my fixture put the
comment *before* the real definition and last-definition-wins masked it. The fixture now puts it
after, which is also the realistic case.

`npm run check` is now twelve steps.
