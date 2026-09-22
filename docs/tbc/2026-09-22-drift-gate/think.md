---
started_at: 2026-09-22T14:31:44+08:00
trigger: 0265 took the admin-role list from 48 copies to 2 — `ADMIN_ROLES` in TypeScript and `admin_roles()` in SQL — and named, in its own closure, that nothing compares them. This is that gate, and its first run is against 0265 as it stands.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — two is better than forty-eight and it is still two

## What 0265 left open

The drift it fixed ran for **24 days** and surfaced by accident: `ADMIN_ROLES` gained `"CFO"` on
2026-08-29, 47 RLS policies did not, and a CFO was an admin everywhere in the application and an
admin nowhere in the database. Nothing reported a problem the whole time, because no check in this
repository compares a TypeScript constant to a SQL value list.

0265 made the SQL side a single function. **The same drift is still available** — edit the constant
and not the function, or the reverse — and it would be exactly as silent, 47 times smaller.

## Why an extension and not a new audit

`enum:audit` already does this job for one kind of source: it compares a declared TypeScript union
against a column's CHECK set, opting in through a `// enum-source: table.column` marker. Its own
build this morning abandoned an inferred version in favour of the declared one, because inference
"cannot tell 'mirrors this column' from 'shares two ordinary words with it'".

A second audit would duplicate the walker, the member extraction, the comparison and the report —
and then the two would drift, which is the joke this build cannot afford to be. What is needed is
one more *source kind*: a function's returned array, keyed so it cannot collide with a column.

## The design, before writing it

- **Marker:** `// sql-source: admin_roles()`, distinct from `enum-source:`. Not a cleverer single
  regex covering both: they are different claims about different things, and one pattern matching
  both kinds has a failure mode of matching the wrong one.
- **Key:** `admin_roles()`, with the brackets. A `table.column` key can never contain one, so the
  namespaces cannot collide without a deliberate effort.
- **Case preserved.** The CHECK half lowercases the SQL because those values are lowercase by
  convention here. Role names are not — `CEO`, `CFO`, `COO`. Lowercasing them would make every
  comparison fail, and the obvious repair (lowercase the mirror too) would then stop catching a
  genuine case mismatch. So the function's values are parsed from the non-lowercased text.
- **Everything downstream unchanged:** the same body extraction, the same member regex, the same
  missing/extra comparison, the same exit code.

## What could go wrong, before I look

1. **A parser that reads past the function.** `function NAME\(\)[\s\S]*?array\[…\]` is non-greedy
   and still unbounded: nothing stops it leaving the function and finding the next `array[...]`
   later in the file. This is the failure mode this audit exists to catch, and writing it INTO the
   audit is the most likely way to get this build wrong.
2. **A marker that matches nothing**, which produces the same green line as a marker that matches
   perfectly. The opt-in design's one real risk, and the reason the existing audit treats an
   unknown key as a finding rather than a skip.
3. **Case.** See above — the direction of the mistake matters: too lenient and it never fires.
4. **A regex that is right on a fixture and wrong on the real migrations.** The 263 real files are
   the only honest test; a fixture proves the shape, not the corpus.
5. **The failure message being about the wrong thing.** The existing closing text is about a union
   member falling through a switch. A role list out of step is a different harm — authority the
   application grants and the database refuses — and a message that describes the other case sends
   whoever reads it looking in the wrong place.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The understanding is 0265's own: 48 copies became 2, and 2 with nothing comparing them is a smaller version of the same defect rather than a fix. Building the gate first and the migration second would have gated a state the gate helped create." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "The methodology must be in the tree at the moment of action.",
    "how_this_build_will_embody_it": "All fourteen clauses were opened at their line ranges in the command immediately before this file was written." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "Layer 1 only. Nothing a user can reach changes; the value is entirely in what the next role change cannot do quietly." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "THINK first about what could fail, then search.",
    "how_this_build_will_embody_it": "The five risks above were written before any code, and risk 1 is the one that fired — the first version of the parser read past the function body and mis-attributed an array from a different statement." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "Consume the verdict; duplicated conditions drift silently with every check green.",
    "how_this_build_will_embody_it": "This is the clause made enforceable. §2.2 says a decision must have one source; until now nothing could tell when it had two in different languages. After this, a second copy that parts company with the first fails the gate." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "Append-only; history intact.",
    "how_this_build_will_embody_it": "No migration, no data. The audit reads the migration history and never writes to it." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "Distrust the confident answer; the biggest risk is the builder under pressure.",
    "how_this_build_will_embody_it": "The confident answer was that the parser worked, because the audit came back green. It was green because no mirror had declared the function it was mis-parsing. Printing what it matched is what found the bug; the verdict would never have." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "The pre-action checklist; item 3 asks whether I am repeating a failed approach.",
    "how_this_build_will_embody_it": "Item 3 rejected a second audit. Duplicating a walker, a comparison and a report to police duplication is the failed approach at its most literal." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "The failure is citing an asset from cached memory of what it says rather than from opening it — having the label without the content, which reads identically from the inside.",
    "how_this_build_will_embody_it": "The existing audit's own docblocks are quoted from the file as it reads today — including its record of its first run being wrong about the very table it was built for." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Opened in one command, timestamped from the clock either side of it." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-696", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "The fix is incomplete until the class is swept to its codebase-wide boundary.",
    "how_this_build_will_embody_it": "0265's boundary was the schema. This build's boundary is the seam BETWEEN the schema and the application — the place the 2026-07-10 sweep that created roles.ts stopped, and a boundary drawn at a language is not codebase-wide." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "A lesson recorded only in prose will return; a fix is not complete until the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "This IS the A30 terminal step for the CFO incident. 0265 fixed the instance and left a prose promise; this is the gate, and it fails on the exact drift, in both directions, without anyone remembering to look." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-798", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "Schema-complete is not built; the seam between database and surface is where each side is individually correct and the system is not.",
    "how_this_build_will_embody_it": "Same seam, different direction. A31 is a surface nothing writes to; this is a role the database never agreed existed. Both are two correct halves that were never compared." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-22T14:31:44+08:00",
    "why_it_governs": "\"Verified\" is a claim about a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code, six new fixture tests, and two mutation probes: the 2026-08-29 drift in both directions, run against the real repository rather than a fixture." }
]
```
