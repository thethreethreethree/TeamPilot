---
started_at: 2026-09-21T13:50:00+08:00
trigger: npm run build:ci had been failing on main. Found only because the previous build had UI and so ran it by name; reproduced at HEAD in a clean worktree.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the line that did nothing, twice

## Why (the record)

`npm run build:ci` — the secretless build, which is exactly what CI's Build step runs — was
failing on `main`:

```
Error occurred prerendering page "/dashboard/meeting-coach/prep"
Error: Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ... in .env.local.
```

Reproduced at HEAD in a clean worktree with no working-tree changes: 381 pages, same page, same
error. Pre-existing, and red for long enough that at least one session shipped without running it.

It was found only because the previous build shipped UI, which made `build:ci` genuinely relevant
rather than skippable — A38's exact claim, arriving on schedule.

## The first diagnosis was wrong, and that is the interesting part

The page mounts `MeetingPrepUp`, which builds the browser Supabase client **during render**
(`useMemo(() => createClient(), [])`) so it can push audio to a signed upload target.
`createClient()` throws by design when the env is absent — a deliberate fail-loud that §1.5.3
would endorse. A static export renders the page on a machine with no public Supabase env, so the
throw lands at build time.

Its sibling `/dashboard/sales-coach/doors` mounts `DoorLog`, which has the **identical** pattern
and does not break the build. The difference appeared to be that `doors/page.tsx` carries
`export const dynamic = "force-dynamic"`. So that line was added to the prep page.

**The build failed identically.** Same page, same error.

§2 is explicit: a repeated failure means the *identification* was wrong, not the implementation.
Retrying with more force is forbidden. So the difference between the two pages was read again
rather than re-asserted, and this time the right one was visible:

| | `doors/page.tsx` | `prep/page.tsx` |
|---|---|---|
| `"use client"` | **no** | **yes** |
| `export const dynamic` | yes, honoured | yes, **inert** |

Route segment config is honoured only in a **server** component. In a `"use client"` file it is
silently ignored — no warning, no type error, no lint. `doors` was never saved by the directive
being *present*; it was saved by the page being a server shell that mounts a client component. The
prep page held a `useRouter` call, which made it a client component, which made the fix a no-op.

**The wrong mental model survived contact with the failure.** That is what makes this worth a gate
rather than a fix.

## The gate (A30, A33)

A30: a lesson recorded only in prose will return. A33: a gate must be **precise** or not exist.

This one is precise by construction, which is unusual and is why it is gated when neighbouring
classes in the same file are explicitly declined. **A `"use client"` page file exporting route
segment config is always wrong** — no import graph, no reachability analysis, no judgement about
what it mounts. At best the line is dead; at worst the page is prerendered against the author's
intent. There is no legitimate instance, so there is no allowlist.

INVARIANT 27 detects the directive as the first *statement* (comments and blank lines may precede
it) using plain string work rather than a regex, because a regex for "first statement" is easy to
get subtly wrong and a subtly-wrong gate is worse than none.

It is self-tested in **both** directions — that it fires on the real 2026-09-21 breaker, and that
it stays quiet on the shipped fix. A guard that only proved it could stay quiet would not have
caught the first, wrong fix, which is precisely the failure this rule exists to prevent.

## Ripple (§1.5)

The fix moves `useRouter` into `MeetingPrepUpRoute` and leaves `page.tsx` a server shell. Nothing
else changes: `MeetingPrepUp` is untouched, its props are unchanged, and the route's URL, layout
and auth are unchanged.

Swept for the same shape elsewhere: exactly two components construct the browser client during
render (`DoorLog`, `MeetingPrepUp`), and after this fix both are mounted from server shells. The
new invariant reports 0 violations across 1,040 files, so no other page has stranded config.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving; a plausible answer that arrives fast is the one to distrust.",
    "how_this_build_will_embody_it": "The first diagnosis was fast, plausible, supported by a real sibling precedent, and wrong. The build said so." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The governing methodology must be in the tree and read now.",
    "how_this_build_will_embody_it": "§2's no-error-loops clause was re-opened at the moment the second build failed, rather than recalled as a slogan, and it is what turned a retry into a re-diagnosis." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-63", "read_at": "2026-09-21T13:15:00Z",
    "why_it_governs": "Read it as a detached observer with no stake in the existing explanation.",
    "how_this_build_will_embody_it": "The second pass compared the two page FILES rather than defending the force-dynamic theory. The `use client` line is the first line of one and absent from the other; it was invisible while the theory was being protected." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — trace what else this affects before acting.",
    "how_this_build_will_embody_it": "Rather than fixing one page, the class was swept: exactly two components build the browser client at render, and both are now behind server shells. The gate confirms no third." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Layer 1 is structure — will the system remain maintainable after this ships?",
    "how_this_build_will_embody_it": "The split (server shell + client route component) is the shape the working sibling already had, so the codebase ends with one pattern for this rather than two." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "The build exits at the FIRST bad page, so fixing one and re-running would reveal the next one at a time. The class was swept before the first fix was run." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-190", "read_at": "2026-09-21T13:55:00Z",
    "why_it_governs": "A feature depending on config outside the repo is not complete until verified; prefer failing LOUD over failing silently.",
    "how_this_build_will_embody_it": "createClient()'s throw is a correct §1.5.3 fail-loud and is NOT what was changed. The defect was firing it in the wrong place — at build time, where no user is present — so the fix keeps the loud failure and stops prerendering the page." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-280", "read_at": "2026-09-21T13:52:00Z",
    "why_it_governs": "No error loops. If a fix fails, STOP — a repeated failure means the identification was wrong, not the implementation. Retrying a misdiagnosis with more force is forbidden.",
    "how_this_build_will_embody_it": "The clause that governs this entire build. After the first fix failed identically, the second move was NOT another directive or a config variation — it was re-reading the two files and finding the actual difference." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T13:25:00Z",
    "why_it_governs": "A user-specified experience is layer 2, not deferrable polish.",
    "how_this_build_will_embody_it": "Carried from the same session's pitch-detail build, where it decided the grade colouring. It does not bear on this build directly and is listed because the commit range cites it — naming it honestly is cheaper than an invented relevance." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Consume the authority's verdict; do not re-derive it.",
    "how_this_build_will_embody_it": "Bears indirectly and worth stating: the wrong fix here was a DUPLICATE of a decision the sibling page already encoded, copied without the condition that made it work. A re-derived answer that drops a term is the same failure shape at the config layer." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Everything is an event, append-only.",
    "how_this_build_will_embody_it": "Carried from this session's earlier builds. No events are written here; listed because the commit range cites it." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T13:26:00Z",
    "why_it_governs": "The System asks the human what they think before asserting its own answer, and never takes over the diagnosis — making the human a participant is what transfers capability instead of creating dependence.",
    "how_this_build_will_embody_it": "Carried from the dispute build. No product behaviour changes here; listed because the commit range cites it." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T12:45:00Z",
    "why_it_governs": "Hard metrics must stay objective and defensible.",
    "how_this_build_will_embody_it": "Carried from the scoring-trigger build, where it decided the outcome mapping. No metric changes here; listed because the commit range cites it." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "Knowledge is not intelligence; distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "'DoorLog has force-dynamic and works, so add force-dynamic' is a well-sourced, fast, wrong answer, drawn from a real precedent in this repo. It is the shape §5 describes exactly." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "A decision for the founder goes in a picker.",
    "how_this_build_will_embody_it": "No founder decision here — a red build is a defect, not a choice, and it is fixed rather than surfaced." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Holding the labels without the content produces work in the language of the discipline that violates it.",
    "how_this_build_will_embody_it": "`export const dynamic` in a client file IS this failure in code: the label of the discipline, with none of its effect, and it reads as correct to every reviewer." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "§2 was opened from the tree when the second failure landed, not quoted from memory." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "A fix is not complete until the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "INVARIANT 27, with nine self-tests, including one that asserts it would have caught this exact breaker and one that asserts it stays quiet on the shipped fix." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-858", "read_at": "2026-09-21T13:56:00Z",
    "why_it_governs": "Not every lesson can be gated — a gate must be PRECISE or not exist.",
    "how_this_build_will_embody_it": "The reason this one qualifies is written into the rule: it needs no import graph and no reachability, because a client file exporting segment config is wrong whatever it mounts. That is why it sits directly above the DECLINED section, which refuses to gate a costlier class on the same page." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "'Verified' is a claim about a COMMAND you ran, by the project's own name for it.",
    "how_this_build_will_embody_it": "This build exists because build:ci was finally run by name instead of a self-chosen subset, and it had been red the whole time. It is A38's own prediction arriving with a date on it." }
]
```
