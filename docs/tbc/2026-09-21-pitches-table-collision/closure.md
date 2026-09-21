# CLOSURE — the table that already existed

The previous build's residual was about **words**. Filed at medium confidence, softest item on
the list: *"only numbers were swept, not words — 'session' vs 'pitch', 'conversation' vs
'presentation'."*

The first word I checked was **pitch**, and it is a table name.

Migration 0215 created `pitches` for the Door Log three months ago — `knock_id`, `name`,
`audio_path`, `status` — with `pitch_transcripts` and `pitch_analyses` hanging off it and five
library functions reading it. Migration 0252, written two days ago, says `create table if not
exists pitches (...)` for something else entirely: base, bonus, violations, qualifying,
section_points, rubric_version.

`if not exists` does not warn.

Applied to Postgres 16 on a database that has the Door Log:

```
NOTICE:  relation "pitches" already exists, skipping
ERROR:   column "qualifying" does not exist
```

**The Pitch Score system could never have deployed.** Not a corner case, not a race — the
migration dies on the second statement, on every real database, and everything built on top of
it for two days was sitting on a table that does not exist.

That is the *merciful* outcome and it is worth saying why. The failure was loud only because the
two shapes are wildly different, so the next statement asked for a column that was not there. Had
they overlapped enough to apply, two features would now share a table: the score writer would be
inserting onto rows the transcription worker owns, `pitch_score_elements` would be foreign-keyed
to door recordings, and nothing would error anywhere.

## Why the verification passed

I verified these migrations against real Postgres. Twice. Seven asserted properties, each one
checked with a query, each one reported with its output.

The prelude created `companies`, `auth.users`, `coaching_sessions` and `profiles` — the tables my
migration *referenced*. It did not create `pitches`, because nothing in my migration pointed at
it.

That is the entire mechanism, and it generalises: **a prelude built from the new migration's own
references can only contain what the new migration already knows about.** It is structurally
incapable of finding a collision. The more carefully it is derived from the migration, the more
completely it guarantees the migration will pass.

A38 says "verified" is a claim about a command you ran, and that the agent invents its own recipe
and runs a subset while reporting it in the project's words. This is that at the schema layer,
and the subset was invisible because the recipe looked thorough. Real Postgres. Three migrations.
Idempotent re-apply. INVARIANT 4 confirmed both ways. All true. All measuring a database that
cannot exist.

## The second symptom

Renaming turned `rls:audit` from green to **9 missing policies**.

A revelation, not a regression. The audit tracks policies by table name, so my `pitches` had been
inheriting the Door Log's insert/update policies. `pitch_scores.insert` and `pitch_scores.update`
had no coverage and no allowlist entry, and the audit reported green because it could not tell
the two tables apart either — the same confusion, one layer up, hiding a real gap.

One bug, two symptoms, and the second only became visible once the first was fixed.

## §1.7 earned its keep

*"A problem at layer N propagates upward to every layer above it, so flags at the bottom are
leveraged more than flags at the top."*

This is the lowest layer touched all session, and it invalidated every layer above it while all
of them reported green: 4,696 tests, six audits, a passing production build, eleven committed
builds. None of them could see it, because none of them apply a migration to a database that
already has the product in it.

And it is the fourth §2.2 duplicate of the day — after the manager predicate, the lowest-section
helper and the score bands. The first three were duplicated *decisions*. This one was a
duplicated *name*, which is the same failure with a bigger blast radius.

## The asset that already described this

`ThinkerThinker.md` A21 is titled *"Audits that look WITHIN modules but not ACROSS modules miss
**same name, different feature** composition failures."* It was captured in June, after the
founder pointed at two panels called Ask Coach that were completely different features, and said:
*"this is one of the system inconsistency I wanted you to catch."*

Migration 0252 **cites A21 in its own header** — about a different concern, one manager
definition — while committing the exact failure the asset names, in the same file, on the same
day. A19 in one line of SQL comment.

And A12 is the other half. *"Migrations are safe-to-re-run by construction"* is why every
create in this repo carries `if not exists` — and `if not exists` is precisely what swallowed the
collision without a warning. The two assets pull against each other: one wants re-runnable, one
wants distinct, and the idiom that satisfies the first silently defeats the second. INVARIANT 28
is what lets both hold — keep the idempotent idiom, catch the clash statically instead.

## The gate

INVARIANT 28: two migrations must not `create table` the same name. No allowlist — there is no
legitimate instance, whatever the shapes are. Proven by reinstating the real collision.

Its wiring self-tests earned their place on the first run: the loop initially iterated `FILES`,
which walks only `src/` for `.ts`, so it matched nothing and reported a confident zero. The
self-test caught it. That is the **second time today** a self-test has caught a guard that had
silently stopped looking, and both times the failure presented as an improvement.

---

## Residual

```json
[
  { "id": "R1-the-prelude-is-still-hand-built-and-that-is-the-flaw-that-caused-this",
    "item": "Verification now runs against a prelude that includes 0215, because I know to include it. It does not include the other ~250 migrations. A collision with any of those would be invisible in exactly the same way.",
    "why_skipped": "Applying the full migration history to a scratch database on every check is a real piece of infrastructure — ordering, extensions, seed data, runtime — and it is a build of its own.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T17:40:00Z",
    "outcome": "OPENED, and it is the honest limit of this build. INVARIANT 28 covers the table-name case specifically and cheaply, which is the highest-value slice. What it does not cover: a migration that ALTERs a table it did not create, an index or constraint or function or type or policy name colliding, or an enum value added twice. Each is the same shape. The real fix is applying the whole history in CI — which would have caught this in seconds and catches the rest for free." },

  { "id": "R2-only-one-word-was-swept",
    "item": "The vocabulary sweep that found this checked 'pitch' and stopped, because the first entry was a deployment blocker. 'session', 'score', 'conversation', 'presentation', 'points' are unchecked.",
    "why_skipped": "Fixing the blocker took precedence over continuing the sweep.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T17:41:00Z",
    "outcome": "OPENED as the immediate next work. The hit rate so far is one for one, and the one was the most serious defect of the session. 'session' is the obvious next: coaching_sessions is a table, the gamification system computes SESSION points, and the Pitch Score system treats a session as the container for a pitch — three meanings, at least two of which appear on the same screen." },

  { "id": "R3-editing-committed-migrations-in-place",
    "item": "0252, 0253 and 0254 were edited rather than superseded. The append-only convention for migrations was set aside.",
    "why_skipped": "Not skipped — argued. A 0255 rename cannot work because 0252 never created the table; there is nothing to rename. These have never applied to any database that has the Door Log, which is every real one.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T17:42:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. The argument holds IF no database has run 0252 successfully — which is true of any database with the Door Log, and every real one has it. The gap: a developer's scratch database created from migrations alone, with no door-log data, WOULD have applied 0252 and now has a `pitches` table with scoring columns that will never be renamed. Rare, recoverable by recreating the database, and worth stating rather than assuming away." },

  { "id": "R4-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried unchanged for the eleventh build.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T17:43:00Z",
    "outcome": "OPENED. It would not have prevented this one — a guide does not tell you what table names are taken. The product did, and nobody asked it." }
]
```
