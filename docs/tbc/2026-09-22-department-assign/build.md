# BUILD — a capability with a read, two writers, and no door

## What was built

The door. No migration, no new table, no new writer — all of that has existed since 0055.

### `GET/POST /api/team/departments`

- **write-path:** `src/app/api/team/departments/route.ts`. GET returns every assignment in the
  caller's company as `byMember`. POST takes `{ memberId, departmentIds }`, diffs against the
  current set, and calls `assignUserToDepartment` / `removeUserFromDepartment` — the two writers
  that have existed with zero callers since 0055.
- **read-path:** the team page loads both once per render rather than per row.

**Who may do this is decided once, in the database.** The route uses the CALLER-SCOPED client, so
`profile_departments_insert_admin` / `_delete_admin` are the authority rather than a second copy of
the rule in TypeScript that can drift (§2.2 — the failure 0265 spent 47 policies correcting). A
side effect worth naming: after 0265 those policies read `admin_roles()`, so **a CFO can assign
departments without a line here being written for it.**

The one check the route adds is the tenant pin, because an RLS refusal cannot say *why*, and
"not found in your company" is the honest answer to an id from another tenant.

**A diff, not a replace-all.** `assigned_by` and `assigned_at` record who put this person in this
department and when. Rewriting every row on every save would falsify both for the rows that did not
change — turning a record of what happened into a record of the last time anyone pressed Save
(§3.1).

**A partial save is reported as a partial save.** These are several statements, not one
transaction, because the writers are per-row. On any failure the route answers 500 **with the set
that actually holds**, read back rather than echoed, so the page stops showing the request.

### The control, on the member row

- **write-path:** `src/app/dashboard/team/page.tsx` — a `<details>` picker beside the org-role
  select, admin-only, with a checkbox per department and a line saying what the assignment does.
- **read-path:** `setDepartment` posts the new set and refreshes from the server's answer.

Hidden entirely when either read failed — an empty picker would read as "this company has no
departments", which is the reassuring-lie shape this session has spent the day removing. `null`
from `listProfileDepartments` means the read failed, not that the person is in no department; the
row distinguishes them.

The picker says what it is for: *"A file this person uploads is filed here when nothing else in the
upload says where it belongs."* A control whose effect is invisible on the page it lives on needs
to explain itself (§6, item 5a).

**And a company with no departments gets a link, not silence.** Hiding the control is correct —
there is nothing to assign to — but it leaves an admin wondering where it went, and the answer is
one page away at `/dashboard/settings/departments`. A dead end is not a flowing state. Found by
re-reading the render condition rather than by a test; no test can see the difference between a
control that is correctly absent and one that is missing.

### The loop, closed

- **write-path:** none — `autoRoute.ts` rule R3 is unchanged.
- **read-path:** `src/lib/files/__tests__/autoRoute.rule3.test.ts`, five cases.

**R3 has never run.** It reads `profile_departments`, which was permanently empty, and the existing
`autoRoute.test.ts` sets `uploaderId: null` with the comment *"skip Rule 3 (uploader-department
fallback)"* — so the suite never exercised it either. The rule was untested because it was
untestable, and unfireable because nothing could fill the table.

It fires now: `R3:uploader-dept-fallback=1`, and the file routes to the uploader's department. That
is the difference between the form saving and the feature working (§1.5.1 layer 3).

## Ripple

- **`writer:audit` is unchanged and still passes** — it always did. The table had writers; what it
  lacked was a reachable one, which that audit does not ask about.
- **`autoRoute` is untouched.** No behaviour changed there; it became *reachable*.
- **The team page gains two fetches**, both best-effort and independent of the roster.
- **No migration.** 0055's schema was right all along.
