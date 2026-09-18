---
started_at: 2026-09-19T05:00:00+08:00
trigger: Adding two agents to Align Sales Pros by hand surfaced three defects on the paths that add was made of.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a shared password nobody is forced to rotate is not temporary

## Why (the record)

The founder asked for two people to be given access to Align Sales Pros: they "seem to have
difficulty making an account." Neither email existed in `auth.users` — all 23 scanned — so the
difficulty was not a broken signup. No account had ever been made.

That is a five-minute operational task. What makes it a build is what the task walked through:
`api/team/add-member`, `handle_new_user`, `must_change_password`, and the test suite used to
confirm any of it. Each one had something wrong with it, and none of the three was visible from
the surface the founder was looking at.

## The defects

**D1 — the forced rotation only covered one door.** `must_change_password` is written by
`add-member` and enforced in exactly one place: `src/app/dashboard/layout.tsx`. The middleware
matcher covers `/dashboard`, `/onboarding`, `/login`, `/sales-coach/login` — not `/api/*` — and
the extension's own gate resolves Bearer auth plus **company** entitlement, never the flag.

The threat model is the route's own design, stated in its header comment: the admin creates the
login with "a picked TEAM PASSWORD" and "distributes the team password out-of-band." One secret,
several new hires. The forced rotation is the only thing that retires that secret from each
account. A rep who works inside the browser extension — the actual daily surface for a
salesperson — never loads a dashboard page, never meets the redirect, and keeps the shared
password live indefinitely.

Measured rather than supposed: signing in with the flag set returns a valid `access_token`. That
was observed while verifying the two accounts this task created, which is how the hole surfaced.

**D2 — a name regression hidden behind a faster path.** `handle_new_user` (0011) seeds
`full_name` from `coalesce(raw_user_meta_data->>'full_name', split_part(new.email,'@',1))`.
`add-member` calls `createUser` with no `user_metadata`, so the coalesce always falls through.
Every member added via "Add agent" is named after their email prefix. The older invite path
already captured a name (`accept/route.ts`, `p_full_name`); the 2026-08-21 fast build dropped it.
This is a *regression*, not a missing feature, and that distinction is why it is fixed here
rather than filed as polish.

**D3 — the instrument used to confirm all of the above was lying by omission.**
`vite-tsconfig-paths` had stopped resolving `@/` for modules Vitest 4 externalises for SSR: 352
of 647 test **files** failed to import, taking 2222 tests with them.

The honest version, because the tempting version is wrong: the suite **did** exit 1. This was
never a silently-green gate. What it was is a *toolchain* failure wearing a per-test line that
read `2110 passed | 0 failed` — a shape that invites "environment problem, not my diff" instead
of "a third of the suite is not running." That is the §5 failure at one remove: not a false
green, but a true red whose own summary argues for ignoring it.

## The hard part

D1's fix is three lines and a 403. The risk is entirely in *where* the flag is read.

`requireExtensionAuth` already selects `company_id, status` from `profiles`. Adding
`must_change_password` to that select is the obvious move and it is a trap: selecting a column
that does not exist errors the **whole** query and returns a null profile, which the very next
line reads as "no company associated" and 403s. If migration 0235 were ever unapplied on an
environment, the tidy one-query version locks out every extension user on that environment.

The dashboard layout already solved this and said so in a comment — it uses a *separate*,
best-effort read for exactly this reason. So the fix mirrors that discipline while keeping the
single-query fast path: read the three columns, and only if that yields nothing, retry the
original two. The gate goes inactive on a missing column rather than closing on everybody.

Fail-open on a security gate deserves a sentence of its own defence. It is the precedent the
codebase already chose; the alternative fails *every* user of a paid surface rather than
admitting one; and 0235 is applied, observed directly in this company's live `profiles` rows.
The risk accepted is bounded and named here rather than discovered later.

## What this build deliberately does NOT do

`resolveApiAuth` is a second Bearer path — 12 routes: KPI, leaderboard, gamification,
sales-session CRUD — with the same gap. Its own comment says it "mirrors the already-proven
extension auth," which is the §2.2 duplicated-decision shape verbatim.

It was put to the founder in a picker against a middleware-wide alternative. They chose the
narrow extension fix. Extending into the mobile surface is a third decision with its own
consequence and is left to them; it is recorded in the residual rather than taken quietly
(§3.3 — guide, don't overtake; and its under-deliver mirror §1.5.4 — say what was left out).

## Session-read manifest

Every clause below was opened in THIS session, from the file named, at the line range given.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-19T05:02:00+08:00",
    "why_it_governs": "Understanding precedes solving — the WHY must be stated before the fix.",
    "how_this_build_will_embody_it": "The extension hole was not fixed on sight. It was traced to the middleware matcher's route list and the single enforcement point in dashboard/layout.tsx, then confirmed by observing that a sign-in with the flag set still yields an access_token." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-19T05:02:00+08:00",
    "why_it_governs": "The methodology defining understanding must be IN the working tree and read now — citing labels from a document not present is the §5 failure mode and is forbidden.",
    "how_this_build_will_embody_it": "Both governing documents are in this tree and were opened at the line ranges given in this session. The clauses added to this manifest after the gate rejected the first draft were read from the files — §0.1, §3.3, §5, §6, A19 and A22 were printed and their text consulted — rather than re-cited from what I already believed they said, which is the exact failure A22 describes." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-130", "read_at": "2026-09-19T05:03:00+08:00",
    "why_it_governs": "Operational effectivity is whether the feature delivers the intended result when invoked the way a real caller invokes it.",
    "how_this_build_will_embody_it": "The intended result of must_change_password is that a temporary credential stops working. Invoked the way a real rep invokes the product — through the extension — it did not. A gate covering only the surface its author happened to be looking at is a layer-2 failure, not a layer-4 one." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-19T05:03:00+08:00",
    "why_it_governs": "THINK first about what could be wrong, THEN search to confirm; mechanical grep alone does not satisfy it.",
    "how_this_build_will_embody_it": "Four hypotheses were written down before searching — duplicate-human risk, the name derivation, a missing name field, and an extension bypass of the password gate. Three confirmed by reading source; the fourth was caught at operational level and handed to the founder. The search followed the hypotheses rather than producing them." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-19T05:04:00+08:00",
    "why_it_governs": "A decision must be computed once by an authority and consumed as a verdict; a re-derived condition drifts.",
    "how_this_build_will_embody_it": "The check sits in requireExtensionAuth — the one authority every extension route funnels through, confirmed by grepping for direct callers and finding none — rather than in each route. It also names the violation this build does NOT fix: resolveApiAuth re-derives the same auth decision, and its own comment says it mirrors extensionAuth." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-225", "read_at": "2026-09-19T05:04:00+08:00",
    "why_it_governs": "A property the USER specified binds at layer 2 and cannot be deferred as polish; doing less than asked while reporting complete is as much a violation as doing more.",
    "how_this_build_will_embody_it": "The founder asked for two people to have access. That was delivered and verified by real sign-in before anything else was touched, and the one thing the ask could not have anticipated — that the security fix adds a password-set step for those same two people — was stated to them plainly rather than buried in a commit." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-19T05:04:00+08:00",
    "why_it_governs": "Ask the human before asserting; never take over the solution. Making them a participant is what transfers capability instead of creating dependence.",
    "how_this_build_will_embody_it": "Two decisions that were the founder's went to them in pickers before any write: whether a second login for Knute would duplicate a human already on the team, and how wide to close the password gate. Their answer narrowed the security fix to the extension, and that narrowing was honoured rather than quietly exceeded — resolveApiAuth was left open and named." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-19T05:04:00+08:00",
    "why_it_governs": "Distrust the confident answer that arrived too quickly; the biggest risk is the builder under pressure making the account LESS honest for a faster result.",
    "how_this_build_will_embody_it": "Under an explicit urgency instruction, the tempting claim was 'the gate was green while a third of the suite never ran.' It was measured instead: the old config exited 1. The louder story was dropped and the narrower true one kept, in the source comment and in check.md, before either was committed." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-440", "read_at": "2026-09-19T05:05:00+08:00",
    "why_it_governs": "Item 0 — any output offering the founder a decision MUST be an AskUserQuestion picker with a recommendation first, never prose ending in a question. Item 1a — the methodology must have been read this session, not recalled.",
    "how_this_build_will_embody_it": "Every decision point in this task used a picker with the recommendation first and the real trade on each option. No prose option-list, no 'your call'. The one place a choice was made without asking — per-user temporary passwords over a shared team password — was stated as a decision taken and why, not left implicit." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-19T05:06:00+08:00",
    "why_it_governs": "Methodology that governs the build is operational, not reference; the failure mode is holding the LABELS without the CONTENT and operating in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "The first draft of this manifest did exactly what A19 warns about — it cited §3.3, §5 and §1.5.4 in prose without having opened them, and the manifest gate caught it. They were then printed from the tree and read before the entries were written. The gate did the work A19 says verbal intent cannot." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-19T05:06:00+08:00",
    "why_it_governs": "Citing from cached memory of what an asset says, rather than from opening it this session, is a violation operating undetected.",
    "how_this_build_will_embody_it": "Recorded plainly: this manifest was rejected once for four cited-but-unread clauses plus five missing from the minimum set. The correction was to read them, not to remove the citations — removing them would have been the cheaper fix and the dishonest one." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "31, 92", "read_at": "2026-09-19T05:05:00+08:00",
    "why_it_governs": "A lesson in prose returns — encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Four tests pin the gate, including both branches of the flag and the missing-column fallback asserting the retry actually ran. A regression that drops the check, or collapses the fallback into one query, fails a named test rather than waiting for the next reader." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "31, 96, 1001", "read_at": "2026-09-19T05:05:00+08:00",
    "why_it_governs": "'Verified' is a claim about a COMMAND you ran, reported in the words of the project's own gate — not a mood.",
    "how_this_build_will_embody_it": "check.md reports npm test, npm run typecheck and the audits with counts and exit codes — including a deliberate re-measurement of the OLD config's exit code, which corrected a 'silently green' story that would otherwise have been asserted and was false." },
  { "id": "drift-guard vein", "source_file": "ThinkerThinker.md", "line_range": "1054-1056", "read_at": "2026-09-19T05:06:00+08:00",
    "why_it_governs": "Two copies of a gate condition with no guard between them drift; the fix is complete only when the class cannot recur.",
    "how_this_build_will_embody_it": "It is why resolveApiAuth is named explicitly in check.md and the residual instead of being left for rediscovery. This build does not close that class, and says so rather than implying the hole is gone." }
]
```
