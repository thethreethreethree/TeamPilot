# BUILD — "No files attached yet" is three different sentences

## What was built

No migration. No schema change. No new endpoint. Three edits to the layer that was answering a
different question than the one it was asked.

### The m2m filters moved into the query

- **write-path:** `src/lib/data/files.ts` — `listFiles` now selects the matching join table as an
  **inner-joined embed** and filters on its column, in the same request:

  ```ts
  departmentId: { embed: "file_departments!inner(department_id)", column: "file_departments.department_id" },
  taskId:       { embed: "file_tasks!inner(task_id)",             column: "file_tasks.task_id" },
  tag:          { embed: "file_tags!inner(tag)",                  column: "file_tags.tag" },
  ```

  `!inner` makes PostgREST emit an INNER JOIN, so a file with no matching join row never enters
  the result — which means `.limit()` applies to the FILTERED set. Several filters compose as an
  AND, which is what the JavaScript chain did after the fact. The post-filter block is gone.
- **read-path:** `src/app/api/files/route.ts:56` is the only caller.
  `listFiles.filterBeforeLimit.test.ts` asserts the select string carries `!inner` and that the
  `.eq()` lands on the embedded column. Making the joins outer, or dropping the `.eq()`, each
  fails two cases by name.

The old code read the 200 most recent files in the tenant and filtered afterwards, so `?task=<id>`
meant *"of the newest 200 files anywhere, the ones on this task"*. `TaskAssetsSection` issues
exactly that request on every task detail view, so a task whose assets are older than the window
rendered as **No files attached yet**.

**This is the second implementation, and the first one is worth recording.** It read the join
table first and passed the ids back as `.in("id", […])`. That was correct, and it needed a cap on
the id list — which is the same defect one layer along: a department with more files than the cap
would have had an arbitrary subset silently filtered, with no way to say so. I had even written
the cap's docstring claiming the bound would be "reported rather than silently applied", and there
was no channel to report it through. The embed has no id list, so there is no cap to be wrong
about. Deleted, not documented.

**Neither version can widen visibility.** All three join tables carry
`USING (EXISTS (SELECT 1 FROM files WHERE files.id = <join>.file_id))`, and that nested select is
itself under `files`' RLS — read from the database before this was designed.

### A failed read stops being an empty library

- **write-path:** `listFiles` returns `FileRecord[] | null`; `null` means the read failed.
  `/api/files` answers **500** on null instead of 200-with-`files: []`.
- **read-path:** `src/app/dashboard/files/page.tsx:433` already had the branch —

  ```ts
  } else {
    // The primary library fetch failed — flag it so the render shows an
    // error, not the "No assets yet" empty state.
    setLoadError(true);
  }
  ```

  **It could not run.** The swallow meant `res.ok` was always true. This is the first change that
  makes an existing, correct, commented piece of UI reachable — the fix is at the layer that was
  erasing the decision, not at the surface that already made it.

### The task panel gets the error state the library page has had

- **write-path:** `src/components/files/TaskAssetsSection.tsx` — a `loadError` state, set on a
  non-ok response and cleared on success, rendered before the empty state as *"Couldn't load this
  task's files"* with a Retry.
- **read-path:** `TaskAssetsSection.errorHonesty.render.test.tsx`, four cases including the one
  that matters in the other direction — a SUCCESSFUL read of nothing must still say "No files
  attached yet", or the fix has only moved the lie.

## The third site, and why it is not treated the same

The sweep found three places that return `[]` on a failed read. `src/lib/data/departments.ts`
holds two of them and they get different answers:

- **`listDepartments` (line 55) keeps returning `[]`** — with a comment saying why. It feeds the
  department filter dropdown, and an empty dropdown on failure is a degraded control, not a false
  claim about the world. The files page's own comment already made that judgement ("their failure
  just empties a dropdown"). What was missing is that the judgement was invisible: the line looked
  identical to the one that was wrong.
- **`listProfileDepartments` (line 139) now returns `null`.** An empty answer there is a claim
  about a *person* — "in no department" — and it is used for scoping.

## Ripple

- `listFiles` has exactly one caller; `/api/files` has two consumers. The library page already
  handled a 500; the task panel now does.
- `FileDropzone` and the POST path do not read the list and are untouched.
- `listProfileDepartments` has **zero callers**, so its type change ripples nowhere — which is
  itself the finding carried into the residual.
- **No extra round trip.** The embed travels with the existing query. The join columns are
  indexed — `file_tasks_task_idx (task_id)`, `file_departments_dept_idx (department_id)`,
  `file_tags_company_lookup_idx (tag)` — checked against the database, not assumed.
- `fetchJoinRows` still reads all three join tables afterwards to hydrate each row's
  `departmentIds` / `taskIds` / `tags`. Unchanged, and deliberately not merged with the embed: it
  needs ALL of a file's joins, and the embed returns only the filtered one.
