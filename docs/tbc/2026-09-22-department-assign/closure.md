# CLOSURE — a capability with a read, two writers, and no door

## What is true now

A person can be put in a department, and a file they upload is filed there when nothing else in the
upload says where it belongs.

The second half is the part that makes this finished rather than saved. **Rule 3 in `autoRoute` had
never run** — not once, in the product's life. It reads `profile_departments`, which had a table,
RLS, a read and two writers since 0055 and no caller, so it was permanently empty. The existing
`autoRoute.test.ts` even sets `uploaderId: null` with the comment *"skip Rule 3"*, so the suite had
never exercised it either: untested because untestable, unfireable because nothing could fill the
table.

## The shape worth remembering

`writer:audit` — built this morning, in this session — passes `profile_departments`. The table HAS
writers. What it lacked was a **reachable** writer, and a writer nothing calls is the same fact as
no writer, dressed as compliance.

That is not a criticism of the audit; it is the limit of what a table-level check can ask. The gap
between "a writer exists" and "a writer runs" is the same gap A31 was captured from — seven features
reported BUILT whose columns nothing could write — and it is one indirection finer than any gate in
this repository looks.

## What this build did not do, on purpose

**No export-level reachability audit.** The obvious version — flag an exported function nothing
calls — fires on every helper exported for a test, and A30 is explicit that an imprecise gate is
worse than none. Refused this morning for the same reason and refused again here.

## Residual

```json
[
  {
    "id": "R1-how-many-other-writers-are-unreachable",
    "item": "`profile_departments` had two writers and no caller. Nothing has asked the same question of every other writer in the codebase.",
    "why_skipped": "The gate that would answer it is the export-level reachability audit refused above.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T18:05:03+08:00",
    "outcome": "OPENED AND THE CONFIDENCE WAS WRONG. `departments.ts` alone had THREE unreachable exports, not two — `listProfileDepartments` as well as the writers — and all three are now called. But the same file's `archiveDepartment` and `unarchiveDepartment` have 3 references each, `createDepartment` 9, `renameDepartment` 10, so the file is a mix rather than dead. The honest statement is that one file was checked because one table was suspicious, and the question was never asked of the other 152 tables the writer audit covers. Not a sweep I can do precisely without the gate that A30 says not to build imprecisely — which leaves the class open by design, and that is worth stating plainly rather than filing as done."
  },
  {
    "id": "R2-the-end-to-end-claim-is-not-automated",
    "item": "Assign a department in the UI → upload a file → watch it route. Three layers in one gesture, and no test crosses all three.",
    "why_skipped": "It needs a browser and a database in the same harness, neither of which exists here.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T18:05:03+08:00",
    "outcome": "OPEN, and decomposed rather than waved at. The three links are each covered separately: the route's diff and partial-save behaviour (7 tests), R3 firing given a row (5 tests), and the RLS policies that gate the write (behavioural probe in the 0265 build). What is NOT covered is that the surface writes a row the shape R3 reads — the two halves agree on `profile_departments.department_id` by inspection, not by a test. That is the seam A31 is about, one link further along than the one this build closed."
  },
  {
    "id": "R3-the-picker-has-never-been-rendered",
    "item": "A `<details>` with a checkbox per department, inside a flex row that already holds a select and two icon buttons.",
    "why_skipped": "No browser in this session.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T18:05:03+08:00",
    "outcome": "OPEN, and the most likely thing in this build to be wrong in a way tests cannot see. The panel is absolutely positioned inside a row with `overflow` unset; whether it escapes its container, collides with the reset-password button, or opens off-screen on a narrow viewport are three questions jsdom cannot answer. Twenty-third consecutive build shipped without a real render."
  },
  {
    "id": "R4-no-test-asserts-a-non-admin-cannot-do-this",
    "item": "The authority check lives in RLS, deliberately. No test in this build runs as a non-admin and watches the write fail.",
    "why_skipped": "That needs a database; the 0265 build has a behavioural probe of the same two policies.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T18:05:03+08:00",
    "outcome": "OPEN, with the evidence it leans on named. 0265's probe impersonated a CFO and watched `profile_departments` accept an insert, and a Member be refused on `departments` — the same policy family, the same session, against real Postgres. That is adjacent evidence, not this route's. What would close it is the SQL-level harness three builds have now asked for."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser —
including the picker this build added.
