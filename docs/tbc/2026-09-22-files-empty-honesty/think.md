---
started_at: 2026-09-22T13:17:46+08:00
trigger: The third site in the sweep that found the notification-bell defect. `listFiles` filters after its LIMIT and swallows a failed read into an empty library — and the library page already has the error state that swallow makes unreachable.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — "No files attached yet" is three different sentences

## Where this came from

Fixing the review queue produced a hypothesis about the codebase rather than a closed incident: a
`.limit()` applied before the `.filter()` that decides what a number means. The sweep returned
seven sites. The bell was one. `src/lib/data/files.ts` is the other, and it is worse in a quieter
way, because the same sentence covers three different situations.

## What a user sees, and what it can mean

`TaskAssetsSection` renders exactly two states — a list, or:

> No files attached yet.

That sentence is currently displayed when:

1. **The task genuinely has no files.** Correct.
2. **The task's files are older than the tenant's newest 200.** `listFiles` reads
   `.order("created_at", desc).limit(200)` and then filters by task in JS, so a task filter means
   "of the 200 most recent files in the tenant, the ones on this task". An older task's assets
   fall off the end.
3. **The read failed.** `if (error || !data) return [];` — the route then answers **200** with
   `files: []`.

Three states, one sentence, and two of them are false.

## The part that decides the design

The library page at `src/app/dashboard/files/page.tsx:433` **already** distinguishes case 3:

```ts
} else {
  // The primary library fetch failed — flag it so the render shows an
  // error, not the "No assets yet" empty state.
  setLoadError(true);
}
```

**That branch cannot run.** `listFiles` swallows the error, the route returns 200, `res.ok` is
true. Someone identified this exact class, wrote the defence, and the data layer underneath
guarantees it never fires.

So this is not "add error handling". It is: a decision made at the surface is erased at the layer
below it. §2.2 from the other direction — not two copies of a condition drifting, but one layer
quietly overruling another. The fix belongs at the layer that lies, and the surface work is
already half done.

## The class, swept to its boundary (A26)

```
grep -rn "if (error[^)]*) return \[\];" src --include=*.ts --include=*.tsx
```

**Three sites, and that is the whole codebase:**

| Site | An empty answer claims |
|---|---|
| `data/files.ts:294` — `listFiles` | "this task has no assets" / "your library is empty" |
| `data/departments.ts:55` — `listDepartments` | the department filter has no options |
| `data/departments.ts:139` — `listProfileDepartments` | this person belongs to no department |

Every other failable read in the project already returns `null`. These three are holdouts, not a
house style.

**Not all three get the same treatment,** and deciding that is the point of writing them down:

- `listDepartments` feeds a filter dropdown, and the files page's own comment says an empty
  dropdown on failure is acceptable. That is a defensible call — but it is currently made by
  accident, at a line indistinguishable from the one that is wrong. It should say so.
- `listProfileDepartments` returns a claim about a *person*, used for scoping. Same treatment as
  `listFiles`.

## What could go wrong, before I look

1. **The pre-read widens visibility.** If filtering by task means reading `file_tasks` first, that
   read must not see rows the caller cannot. Checked before designing: all three join tables carry
   `USING (EXISTS (SELECT 1 FROM files WHERE files.id = <join>.file_id))`, and that nested select
   is itself under `files`' RLS. It narrows; it cannot widen.
2. **An empty pre-read issuing an empty `in` filter**, which is malformed rather than "no matches".
   Short-circuit instead — and that empty result is honest, because it is a successful read of
   nothing.
3. **A pre-read with thousands of ids** becoming a URL-length problem. Bound it, and say what the
   bound means rather than letting it become the same defect one layer along.
4. **Changing the return type breaking the other consumer.** `listFiles` has exactly one caller
   and `/api/files` has two consumers; one already handles a failure and one does not.
5. **Over-correcting into a 500 for an empty library.** Null must mean *the read failed*, never
   *nothing matched*.

## Flagged, not decided here

While checking who calls the third site: `listProfileDepartments`, `assignUserToDepartment` and
`removeUserFromDepartment` have **zero callers**. No surface in the product can put a person in a
department — and `autoRoute.ts:245` has a rule (R3, route an upload to the uploader's own
department) that reads `profile_departments` and can therefore never fire. Its non-firing is
invisible: the rule trace only records R3 when it matched.

`writer:audit` passes it, because the table has a writer. It does not ask whether the writer is
*reachable*, and a writer nothing calls is the same fact as no writer, dressed as compliance.

Whether people-in-departments is unfinished or abandoned is the founder's call, and it decides
whether the fix is a surface or a deletion. Carried into this build's residual for a picker, not
answered by me.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "Understanding precedes solving — the problem must be understood before a fix is permitted.",
    "how_this_build_will_embody_it": "The understanding that changes the design is that the surface ALREADY solved case 3 and the data layer erased it. Without reading page.tsx:433 this would have been built as 'add an error state', which is the wrong fix at the wrong layer." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "The methodology must be in the tree at the moment of action.",
    "how_this_build_will_embody_it": "Both documents are in the tree and hashed above; every clause below was opened at its line range today." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "Four layers, foundation up; layer 2 is whether the feature delivers its result when a real user invokes it the way a real user would.",
    "how_this_build_will_embody_it": "Opening a task and looking at its assets is the invocation. The panel currently answers 'no files' to a question it did not ask the database properly. Layer 2, not layer 4 — the copy is fine; the answer is wrong." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "THINK first, then search; the agent audits as it works.",
    "how_this_build_will_embody_it": "This build exists only because the previous one's defect was treated as a hypothesis about the codebase. Nobody reported a files bug." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "Consume the verdict; a decision must not be re-derived or overruled downstream.",
    "how_this_build_will_embody_it": "The inverted case: the surface decides 'a failed read is not an empty list' and the data layer below it decides otherwise, silently. The verdict has to survive the layer boundary — which here means null reaching the route." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "Append-only; history intact.",
    "how_this_build_will_embody_it": "Nothing here deletes or rewrites data. The profile_departments finding is recorded rather than acted on, because deleting three exports is a decision about a capability, not a cleanup." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "Distrust the confident answer; the biggest risk is the builder under pressure.",
    "how_this_build_will_embody_it": "The confident answer is 'three sites, fix all three'. Two of them are not the same problem, and the departments dropdown case is arguably correct as it stands. Fixing it reflexively would be tidiness mistaken for rigour." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "The pre-action checklist; item 5a is workflow continuity.",
    "how_this_build_will_embody_it": "5a: a user who sees 'no files attached' stops looking. That is a flowing state built on a false premise, which is worse than a stall — they do not know to retry." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "The failure is citing an asset from cached memory of what it says rather than from opening it — having the label without the content, which reads identically from the inside.",
    "how_this_build_will_embody_it": "A26 and A31 are quoted below from the paragraphs as they read today, opened at their line ranges, not from memory." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Every id here was opened today; the two added for this build (A26, A31) were read at 13:15:33 while the previous build's gate was running." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-696", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "A reported bug is one instance of a class; the fix is incomplete until the class is swept to its codebase-wide boundary. Its own capture names 'live-error-vs-empty swallowing' as one of the classes it was validated on.",
    "how_this_build_will_embody_it": "The sweep ran before the fix and the boundary is three sites, stated with the command that finds them. The class was swept once before and these three survived it, which is the fact that makes the sweep worth repeating rather than assuming." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "Gate the class; a gate must be precise or not exist.",
    "how_this_build_will_embody_it": "Why I am NOT building an export-level reachability audit for the profile_departments finding. The obvious version fires on every helper exported for a test, and an imprecise gate is worse than none." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-798", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "Schema-complete is not built; the seam between the database and the surface is where a correct system silently becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "profile_departments is the canonical shape: table correct, read correct, both writers correct, no surface — and a routing rule that depends on it and can never fire. Recorded with its consequence named rather than reported as BUILT, which is the mistake A31 was captured from." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-22T13:18:40+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "npm run check with its exit code on its own line, plus a mutation probe that reverts the pre-read and names the test that catches it." }
]
```
