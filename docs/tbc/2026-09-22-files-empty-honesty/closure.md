# CLOSURE — "No files attached yet" is three different sentences

## What is true now

A task's asset panel says three different things for three different situations, instead of one
sentence for all of them:

| Situation | Before | Now |
|---|---|---|
| the task has no files | "No files attached yet." | unchanged — it was the only true case |
| the files are older than the tenant's newest 200 | "No files attached yet." | the files, because the filter is in the query |
| the read failed | "No files attached yet." | "Couldn't load this task's files." + Retry |

And the library page's own error branch — written months ago, with a comment explaining exactly
why it exists — can run for the first time.

## The shape worth remembering

**A decision made at the surface was erased by the layer beneath it.** Someone recognised that a
failed read must not render as an empty state, wrote the branch, wrote the comment, and shipped
it. `listFiles` returning `[]` on error meant the route answered 200 and the branch was
unreachable. Nothing anywhere reported a problem, the code read correctly at both layers, and the defence was inert.

That is §2.2 inverted. The clause is about a consumer re-deriving a decision the authority already
made; this is a producer quietly overruling a decision the consumer had already made correctly.
Both drift the same way — silently, with nothing to see at either end — and both are invisible from inside
either file.

## What I got wrong on the way, and kept

The first implementation read the join table first and passed the ids back as `.in("id", […])`.
It behaved correctly, all seven of its cases held, and it needed a cap on the id list — `JOIN_FILTER_ID_CAP =
2000`. I wrote the cap's docstring claiming the bound would be "reported rather than silently
applied", and **there was no channel to report it through.** A department with more files than the
cap would have had an arbitrary subset filtered, silently. That is the defect this build exists to
fix, reintroduced one layer along, in the same commit, by me, with a comment denying it.

The inner-joined embed has no id list, so there is no cap to be wrong about. The pre-read was
deleted rather than documented.

## Residual

```json
[
  {
    "id": "R1-the-embed-changes-the-shape-of-each-row",
    "item": "`select(\"*, file_tasks!inner(task_id)\")` returns an extra `file_tasks` key on every row, and an inner join on a one-to-many relation could in principle return a file more than once.",
    "why_skipped": "`mapBase` reads named columns and returns a fresh object, so an extra key cannot reach a `FileRecord`; and the tests pass.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T13:24:17+08:00",
    "outcome": "OPENED AND CONFIRMED, and the second half was the part worth opening. `mapBase` (files.ts:81-104) lists all twenty columns explicitly and constructs a new object — the embed's key is dropped, and `attachJoins` spreads that result, not the raw row. On duplication: PostgREST nests embedded resources rather than flattening them, AND each join table's primary key is (file_id, <other>) — `file_tasks_pkey btree (file_id, task_id)`, `file_departments_pkey btree (file_id, department_id)`, `file_tags_pkey btree (file_id, tag)` — so filtering to one value admits at most one join row per file either way. The confident summary would have stopped at 'mapBase ignores it'; the PK is the fact that makes duplication impossible rather than merely unobserved."
  },
  {
    "id": "R2-the-embed-is-not-exercised-against-postgrest",
    "item": "The `!inner` select string and the `.eq()` on an embedded column are asserted against a mock of the query builder. A malformed embed would fail at runtime while the whole suite still reported success.",
    "why_skipped": "This repo has no harness that runs a data-layer read against a real database.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T13:24:17+08:00",
    "outcome": "OPEN, with the risk reduced but not removed. The identical construction shipped in this codebase and ran in production: `readReviewFlags` ran `.select(\"… pitch_scores!inner(id, rep_id, company_id, recorded_at)\")` with `.eq(\"pitch_scores.company_id\", …)` on the manager dashboard until 0264 replaced it this morning (read from commit dfe8204d). That is precedent, not a test. It is the same gap as 0264's view, and the two together are now the strongest argument for a SQL-level harness — which is a build, not a residual line."
  },
  {
    "id": "R3-a-capability-wired-to-nothing",
    "item": "`listProfileDepartments`, `assignUserToDepartment` and `removeUserFromDepartment` have zero callers. No surface can put a person in a department, so `autoRoute`'s rule R3 (route an upload to the uploader's own department) can never fire.",
    "why_skipped": "Whether this is unfinished or abandoned decides whether the fix is a surface or a deletion, and that is the founder's call, not a cleanup I should make silently.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T13:24:17+08:00",
    "outcome": "OPEN AND CARRIED TO A DECISION. Opened far enough to state the consequence rather than the symptom: R3's non-firing is invisible by construction, because `autoRoute` pushes `R3:uploader-dept-fallback` into the rule trace only when it matched — so a trace with no R3 line reads as 'not needed' rather than 'inert'. Also noted: `writer:audit`, which I built this morning, passes this table because it HAS a writer. It does not ask whether the writer is reachable, and a writer nothing calls is the same fact as no writer, dressed as compliance. I am not extending the audit to export-level call analysis on my own initiative — the obvious version fires on every helper exported for a test, and A30 says an imprecise gate is worse than none."
  },
  {
    "id": "R4-listDepartments-left-alone",
    "item": "The third site in the sweep still returns `[]` on a failed read.",
    "why_skipped": "It feeds a filter dropdown. An empty dropdown on failure is a degraded control, not a false claim about the world — and the files page already made that judgement in a comment.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T13:24:17+08:00",
    "outcome": "DELIBERATE, and now stated in the code rather than inferable from it. The change is a comment, which is the whole point: the judgement was already correct and was being made by a line indistinguishable from the two that were wrong. If the department filter ever gains a meaning beyond narrowing — a permission, a default — this decision is the one to revisit."
  },
  {
    "id": "R5-no-browser",
    "item": "Both surfaces exercised in jsdom only.",
    "why_skipped": "No browser available in this session.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T13:24:17+08:00",
    "outcome": "OPEN. Twenty-second consecutive build without a real render. The new panel state is a red line plus an underlined Retry inside a task detail card; jsdom asserts the text and says nothing about whether it reads as an error or as decoration."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser.
