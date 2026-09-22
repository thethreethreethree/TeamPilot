---
started_at: 2026-09-22T18:16:06+08:00
trigger: Founder ruling — build the SQL-level harness. Three builds today named it as their residual: 0264's view, `listFiles`' inner-joined embed, and the department route's RLS are each verified against a mock of the query builder rather than a database.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the gap three builds in a row have asked for

## What is actually missing

Not "database tests". Something narrower and nameable: **nothing in the twelve-step gate executes
SQL that the application depends on.**

| Shipped today | How it is verified | What that cannot see |
|---|---|---|
| view `unreviewed_violation_flags` (0264) | a TypeScript double of the view | a change to its `where` clause |
| `listFiles`' `!inner` embed | a mock of the query builder | a malformed embed string |
| `POST /api/team/departments` | mocked writers | the RLS policy that is the actual authority |

Each of those three closures says the same thing in its own words. Three builds asking for the same
missing capability is the signal A26 describes: the instance keeps recurring because the class has
no home.

What DOES exist is most of the machinery, written twice as one-off probes:

- `migration-apply-audit.mjs` replays every migration into a scratch database on demand, and its
  skip-handling is already right — it returns **why** it could not reach Postgres, because
  "SKIPPED" is equally true of a machine with no server and of a healthy container whose role is
  named something else, and those need different actions from the reader.
- 0265's `probe-behaviour.sql` demonstrates the rest: seed rows, `set local role authenticated`,
  set the claim `auth.uid()` actually reads, assert, roll back.

So this is assembly, not invention.

## The design question that decides everything else

**Which database?**

Sharing `migration_audit_scratch` is the obvious answer and it is wrong. That database is dropped
and recreated by the migration audit on every run, and I have now read a half-built schema twice
today — once producing a policy count I reported to the founder as fact and had to correct. A
harness racing its own toolchain is a harness that reports a different answer depending on what
else is running.

So: **its own database**, and the cost question becomes real. Rebuilding it per run is ~2 minutes,
which is not affordable inside `npm run check`.

The answer is a **staleness key**: build once, store a hash of the migration set in the database,
and rebuild only when that hash changes. Cost paid on the first run and on the day a migration is
added; free otherwise.

## What could go wrong, before I look

1. **A skip that reads as a pass.** The single most likely way this build produces harm. A harness
   that silently does nothing on a machine without Postgres makes every claim it would have made
   look verified. The migration audit's own banner says "This is not a pass", and it says it
   because it had to learn that.
2. **A stale database reporting success.** The staleness key IS the harness's own version of the
   bug it exists to catch — if the key is computed wrong, the harness tests yesterday's schema and
   says so confidently.
3. **Tests that leak state into each other.** Everything must roll back, including on failure.
4. **A harness that tests the harness.** The subjects are the three named above; building a general
   database-testing framework is how this becomes a week.
5. **Slowing the gate.** If the harness adds a minute to every `npm run check`, it will be the
   first thing someone disables.
6. **Assuming the connection.** `MIGRATION_AUDIT_PSQL` exists because a stock `psql` on PATH is not
   how this machine reaches Postgres. Whatever the harness uses has to work the same way — and the
   `pg` package is already a dependency, which is a different and simpler route than shelling out.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T18:16:06+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The problem is not 'we have no database tests'. It is that three specific claims are unverifiable, and the harness is scoped to them rather than to a general capability nobody asked for." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T18:16:06+08:00",
    "why_it_governs": "Methodology in the tree at the moment of action.",
    "how_this_build_will_embody_it": "All fourteen opened at their line ranges in the command immediately before this file." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T18:16:06+08:00",
    "why_it_governs": "Four layers, foundation up; a problem at layer N propagates to every layer above.",
    "how_this_build_will_embody_it": "Layer 1, and the layer it protects is 2: a view whose WHERE clause changed, or an embed that stopped parsing, is a surface that returns the wrong rows while every test is green." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-22T18:16:06+08:00",
    "why_it_governs": "THINK first, then search.",
    "how_this_build_will_embody_it": "Risk 1 was written before any code and is the one that decides the design: a skip that reads as a pass is worse than no harness, because it converts three honest residuals into three false assurances." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-22T18:16:06+08:00",
    "why_it_governs": "One source for a decision.",
    "how_this_build_will_embody_it": "The connection details and the scratch-database lifecycle already exist in `migration-apply-audit.mjs`. Where the harness needs the same knowledge it reads the same env vars rather than inventing a parallel convention that drifts." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T18:16:06+08:00",
    "why_it_governs": "Append-only; history intact.",
    "how_this_build_will_embody_it": "Every test rolls back. The harness never leaves a row behind, and it never touches production — the connection is to a local scratch database by construction, not by configuration anyone could point elsewhere." },

  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "175-196", "read_at": "2026-09-22T18:20:08+08:00",
    "why_it_governs": "A feature whose correctness depends on config outside the repository is not operationally complete until that precondition is verified end-to-end OR documented as a blocking setup step and surfaced to the founder — and the clause prefers failing LOUD over failing silently.",
    "how_this_build_will_embody_it": "The harness needs PGUSER/PGPASSWORD, which live outside the repo and are not set in CI. That is exactly this clause's class, and the clause also supplies the mitigation: the skip is loud by design — it prints THIS IS NOT A PASS and names each unchecked claim by its database object, so a CI run that skips is visible in the log rather than silent. Carried to the residual as a blocking setup step rather than left implied." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-22T18:16:06+08:00",
    "why_it_governs": "Distrust the confident answer; the biggest risk is the builder under pressure.",
    "how_this_build_will_embody_it": "The confident answer is that a harness which runs is a harness that works. The two probes it will run first were both WRONG on their first attempt today — one impersonated nobody, one alarmed on a statement that had been refused — and both reported something." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T18:16:06+08:00",
    "why_it_governs": "The checklist; item 3 asks whether I am repeating a failed approach.",
    "how_this_build_will_embody_it": "Item 3 rules out sharing `migration_audit_scratch`. Reading a database that another process is rebuilding has already produced one wrong answer I reported as fact today." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-22T18:16:07+08:00",
    "why_it_governs": "The failure is citing an asset from cached memory of what it says rather than from opening it — having the label without the content, which reads identically from the inside.",
    "how_this_build_will_embody_it": "The migration audit's skip-reason comment is quoted from the file as it reads today, including the incident that produced it." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-22T18:16:07+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Opened in one command, timestamped either side." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-696", "read_at": "2026-09-22T18:16:07+08:00",
    "why_it_governs": "A reported bug is one instance of a class; the fix is incomplete until the class is swept.",
    "how_this_build_will_embody_it": "Three builds naming the same residual IS the class surfacing. The harness is the home it has been missing; the sweep of everything else unverifiable goes in the residual rather than being claimed." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-22T18:16:07+08:00",
    "why_it_governs": "Gate the class; a gate must be precise or not exist.",
    "how_this_build_will_embody_it": "Its own incident is 19 views that read across a tenant boundary — exactly the kind of thing only executed SQL catches. And the precision rule is why this harness gets three named subjects rather than an ambition to cover the schema." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-798", "read_at": "2026-09-22T18:16:07+08:00",
    "why_it_governs": "Schema-complete is not built.",
    "how_this_build_will_embody_it": "A harness nothing runs is the same shape. It goes into `npm run check` in this build or it does not count as built." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-22T18:16:07+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "This build is about what that sentence means. The harness's whole purpose is to make three claims that currently rest on a mock rest on an execution instead — and its own skip path must never be mistaken for one." }
]
```
