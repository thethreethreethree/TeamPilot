# REMEDIATE

### A cast narrowed a database column to fewer values than its CHECK allows

gate-or-promise: gate

`// enum-source: pitch_score_events.type` binds `EVENT_TYPES` to the column's CHECK through the
existing `enum:audit`. Deleting a value now fails the gate by name.

It earned its place immediately: my **first** placement of the marker was above
`export type EventType = (typeof EVENT_TYPES)[number]`, and the audit reported all three values
missing, because it reads from the marker to the first `;` and collects quoted strings — of which
a derived type has none. The gate failed the author, thirty seconds after the author opted in. That
is the property A30 asks for and it is not a rhetorical one.

**What the gate does not cover, stated rather than glossed:** it only audits mirrors that have
*declared* themselves. A union that never adds the marker is invisible to it, which is deliberate —
the script's own comment says *"Zero false positives by construction, because nothing is audited
that has not opted in."* So the gate makes a declared mirror undriftable; it does not find the
undeclared ones. There were 10 declared before this build and 106 CHECK-constrained sets in the
schema.

### The same shape in the door log, one step earlier in its life

gate-or-promise: promise

Fixed (`PitchRow.status` now carries the enum, the cast is gone), and **not gateable by the tool
that gates the first one**: `pitch_status` is a Postgres `ENUM TYPE` created in 0215, and
`enum:audit` parses `check (... in (...))`. A type-level mirror of an `ENUM TYPE` has nothing to
compare against today.

**The promise:** when a column's vocabulary is defined as an `ENUM TYPE` rather than a CHECK, the
TypeScript union that mirrors it is written against `pg_type`'s values read from the migration, and
the narrowing lives at the **row type**, not at the call site that happens to need it. One loose
`status: string` on a row type is what forced every downstream consumer to invent its own union.

Extending `enum:audit` to parse `create type … as enum (…)` is a real and small piece of work. Not
done here because it is a change to a gate, in a build about a crash, and bundling them would make
neither reviewable. Filed as residual R1.

### Two findings closed as correct-as-designed

gate-or-promise: declined

No action. Recorded so the next sweep does not re-open them.

- **`RecordingsTab.tsx:599`**, `l.speaker === "agent" ? "Rep" : "Customer"`. Looks like the same
  everything-else-falls-through shape. It is not reachable: `keyMoments.ts:183` narrows the column
  to `agent | customer | unknown` at the read, and `:597` skips `unknown`, leaving `customer` as the
  only value the ternary's else branch can see. **Correct as designed.**
- **`OUTCOME` at `RecordingsTab.tsx:56`**, three keys with a raw-value fallback. The column's CHECK
  (`0252:99`) is exactly those three. **Correct as designed**, and the fallback is the right
  behaviour for a value that cannot currently occur.

Both were on their way into a findings list before being checked. A 50% false-positive rate on
findings that *look* obvious from a screenshot is the thing to distrust — §5, and the same lesson
this session has now had twice.
