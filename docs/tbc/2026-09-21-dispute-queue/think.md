---
started_at: 2026-09-21T14:15:00+08:00
trigger: The dispute build's R1 — reps were told "your manager will see it" and no manager had anywhere to see it. The dead end was displaced, not closed.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — displacing a dead end is not closing it

## Why (the record)

The dispute build closed with R1, written plainly at the time:

> *"A rep files a dispute, is told their manager will see it, and no manager has anywhere to see
> it. This is the same defect this build was written to fix, displaced by one step rather than
> removed. Before, the product told reps to tap a button that did not exist; now it tells them a
> manager will see something no manager can see."*

That is the third iteration of one pattern in a single day: the rubric sheet promised a Dispute
that did not exist, the dispute promised a manager who could not read it, and each time the
promise shipped one step ahead of the system. A36 says the residual is the highest-yield queue;
this one named its own successor.

## Outside view (§1.3): what does a queue get wrong?

Hypotheses formed before writing, then checked:

1. **Who may read it.** A rep reading a colleague's dispute is an IDOR; a rep *answering* one is
   worse, because an answer closes a complaint and a rep could close their own. **Manager-only,
   both verbs.**
2. **What an answer is allowed to do.** If replying could adjust points, the leaderboard becomes
   quietly editable by whoever handles the most complaints — §3.5's measuring-agreement failure
   with extra steps. **An answer appends an event and writes nothing else.**
3. **What "open" means.** A queue showing answered disputes forever wastes attention; one hiding a
   **re-filed** dispute loses the rep's second complaint — the one they made *because* the first
   answer did not land. Replay, not a flag.
4. **What an empty queue means.** A failed read rendering as "no open disputes" is acted on by
   closing the tab. Same shape as the empty-AI outages this codebase has already paid for twice.

## The §2.2 finding, found on the way in

The manager predicate has a single authority: `isSalesCoachManager` in `skillAccess.ts`, extracted
and unit-tested for a stated reason — *"a future weakening fails CI, not just review."*

`/api/coach/gamification/calibration` did not use it. It carried a local `requireManager` that
**re-derived** the rule as `ctx.isAdmin || sales_coach_role === "admin"`. That agrees with the
authority today. It is precisely the §2.2 / A40 shape: two copies of one condition, both green,
and the moment the authority gains a term — a `manager` coach role, a `removed_at` check — the
copy silently keeps letting people through.

The reason the copy existed is worth naming, because it is the reason such copies always exist:
`AuthContext` does not carry `sales_coach_role`, so every route that wants the predicate must
fetch the column first, and having fetched it the temptation is to decide right there.

**The chokepoint (A33):** `requireSalesCoachManager` does the fetching and hands the decision to
the authority. Routes consume a verdict and never re-express the rule. The calibration route now
uses it, so the copy is gone rather than merely documented.

## What the gates found that I did not

Two findings came from the audits rather than from me, and both were real:

**`.limit(2000)` is a false bound.** PostgREST caps at `max_rows=1000`, so my single-query replay
would have run on a silently truncated history. Not merely "old rows hidden": an answer falling
outside the window makes an **answered** dispute reappear as open, and a manager re-answers work
they already did. Replaced with two bounded queries — newest N disputes, then the answers for
exactly those pitches — so the replay is complete for every row actually returned.

**The route's gate was unrecognised.** INVARIANT 18 flagged the disputes route as anon-writable
because `requireSalesCoachManager` was a name it had never seen. The gate is real; the audit was
right to distrust a name it could not verify. Registered with INV18 and INV26, with self-tests
both ways.

## And a mock that agreed with the code instead of testing it

The reader's test mock ignored `.eq("kind", …)` and handed every query the whole fixture. That was
harmless while the reader made one call, and it double-counted the instant it made two. A mock
that answers every query identically cannot tell a correct two-query read from a broken one — it
is the fixtures-too-clean-to-discriminate failure, one level down, in the test harness itself.
Rewritten to respect the filters.

## Layers (§1.5.1)

1. **Structure** — the predicate has one home; the reader replays events and stores no state
   (§3.1); the component owns its states.
2. **Effectivity** — manager-only both verbs, tenant proven on the write, bounded reads.
3. **Composition** — this is the closing half of the rep-facing dispute. A rep files; a manager
   sees it at the top of Coach Assessment with the item and the timestamp; the reply appears back
   on the rep's Pitch detail. The loop closes for the first time.
4. **Surface** — a queue above the assessment, with its own empty state, so it costs nothing on a
   quiet week and cannot be mistaken for a failed load on a busy one.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving; the problem must be articulated before it is fixed.",
    "how_this_build_will_embody_it": "The problem was not 'build a queue'. It was that a promise had shipped one step ahead of the system three times running, and the third instance was written into the previous build's own residual." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The governing methodology must be in the tree and read now, not cited from cached labels.",
    "how_this_build_will_embody_it": "skillAccess.ts was opened before the manager gate was written, which is how the existing re-derivation in the calibration route was found at all. The Pitch Score implementation guide remains absent — residual R4." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-63", "read_at": "2026-09-21T13:15:00Z",
    "why_it_governs": "Examine it as a detached observer with no stake in the existing assumptions.",
    "how_this_build_will_embody_it": "Four hypotheses about how a queue fails were formed before any code, and the least obvious one — that a re-filed dispute must re-open — is the one a stateful `resolved` flag would have got wrong forever." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "Replacing the calibration route's local gate touched a working feature. Its seven existing tests were run and three failed — traced to fixtures encoding an impossible state rather than to the change, and verified by reading how isAdmin is actually derived in BOTH auth paths." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Layer 3 asks whether the completed feature leaves the user able to continue.",
    "how_this_build_will_embody_it": "This build exists because layer 3 failed twice in a row in the same feature. It is also why the queue distinguishes empty from failed: a manager who reads 'none' when the read broke has been stalled without knowing it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first, then search; the agent co-owns quality rather than only executing the ask.",
    "how_this_build_will_embody_it": "Nobody asked for the calibration route's duplicated predicate to be fixed. It was found while looking for the right gate to use, and fixing it was cheaper than documenting it." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-190", "read_at": "2026-09-21T13:55:00Z",
    "why_it_governs": "A feature is not operationally complete while a precondition it depends on is unverified, and a silent dependence is the defect; prefer failing loud.",
    "how_this_build_will_embody_it": "Carried from the same session's build-fix. The queue's own version of it: a failed read is surfaced loudly rather than rendering as an empty queue, which is the in-app equivalent of the silent dependence this clause forbids." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T13:25:00Z",
    "why_it_governs": "A user-specified experience is layer 2 — the intended result — not deferrable layer-4 polish.",
    "how_this_build_will_embody_it": "Carried from the pitch-detail build. The founder did not specify this surface, so its design is agent-originated and genuinely layer 4 — which is the distinction this clause draws, and the reason it is cited rather than assumed to apply everywhere." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-280", "read_at": "2026-09-21T13:52:00Z",
    "why_it_governs": "Diagnose before patching, and no error loops: a repeated failure means the identification was wrong, not the implementation.",
    "how_this_build_will_embody_it": "Applied when three calibration tests failed after the gate change. The loop would have been to tweak the helper until they passed; instead both auth paths were read, which showed the FIXTURES encoded an impossible state and the change was behaviour-preserving." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "An authority's decision is returned as a verdict and consumed; a consumer must not re-derive it from the raw inputs the authority already judged.",
    "how_this_build_will_embody_it": "The clause that produced the chokepoint. requireSalesCoachManager fetches; isSalesCoachManager decides; a property test asserts the helper agrees with the authority across all fifteen role combinations, so a second copy of the rule fails a test." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Everything is an event, append-only; entity state is DERIVED by replaying events, never edited.",
    "how_this_build_will_embody_it": "There is no disputes table and no resolved flag. Open-ness is replayed from the dispute and answer events, which is what makes re-filing after an unsatisfying answer work correctly and what makes 'changes are logged' a true sentence." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T13:26:00Z",
    "why_it_governs": "The System guides rather than overtakes — making the human a participant in the diagnosis is what makes an accurate but unwelcome insight socially survivable.",
    "how_this_build_will_embody_it": "The whole clause, in one feature. A score handed down with no reply channel is the System asserting its conclusion; the dispute-and-answer pair is what turns it into a conversation between two people with the evidence in front of them." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T12:45:00Z",
    "why_it_governs": "Measure consequence, not agreement; measuring agreement is grading your own homework.",
    "how_this_build_will_embody_it": "Why an answer writes no points. A reply that adjusted the score would make the leaderboard track who complains and who handles complaints, rather than who sells." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "The biggest risk is the builder under pressure making it less honest for a faster result.",
    "how_this_build_will_embody_it": "Three of this build's tests failed when the calibration gate changed. The fast move was to revert or allowlist; instead the two auth paths were read to establish that isAdmin IS isAdminRole(role) in production, which proved the FIXTURES wrong rather than the change." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "Item 0 — a decision for the founder is a picker, never prose.",
    "how_this_build_will_embody_it": "No founder decision is taken here. Whether a manager may OVERRIDE a score, rather than only reply to a dispute, is one — and it is left unbuilt and named in the residual rather than decided quietly." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Holding the labels without the content produces work in the language of the discipline that violates it.",
    "how_this_build_will_embody_it": "The calibration route's local gate carried a comment saying it used 'the same predicate the coaching RLS uses'. The comment was the label; the code was a copy. That is the failure exactly, and the comment is what made it look handled." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "isSalesCoachManager, isAdminRole, getCurrentAuthContext and resolveApiAuth were each opened in this session before any claim was made about what they do — which is how the isAdmin/role equivalence was established as fact rather than assumed." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "A lesson in prose returns; encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The fifteen-combination property test between the helper and the authority is the gate: a second copy of the manager rule cannot be added without failing it. INV18 and INV26 were taught the new gate WITH self-tests rather than just widened." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-858", "read_at": "2026-09-21T13:56:00Z",
    "why_it_governs": "When a pattern resists precise detection, find the CHOKEPOINT where the invariant holds by construction.",
    "how_this_build_will_embody_it": "There is no precise way to detect 'someone re-expressed the manager rule'. So the chokepoint move: one helper that every manager-gated route calls, doing the fetch that made local copies tempting in the first place." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-944", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "The residual is the highest-yield queue, and writing it as a disclaimer is what stops you returning to it.",
    "how_this_build_will_embody_it": "Fourth consecutive build started from the previous one's residual. R1 did not merely note a gap — it predicted that the promise had moved one step ahead of the system again, and that is exactly what this closes." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "'Verified' is a claim about a COMMAND you ran, in the words of the project's own gate.",
    "how_this_build_will_embody_it": "Both of this build's real defects — the false .limit bound and the unrecognised gate — came from running the canonical audit rather than from reading the code. Neither would have appeared in a self-chosen subset." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1052", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Its diagnostic question 3: does any consumer RE-DERIVE the decision from the same raw state after the authority already decided? Grep for the authority's condition variables appearing in a second if.",
    "how_this_build_will_embody_it": "Asked literally — grepped for sales_coach_role === 'admin' — and it returned three sites, one of which was the authority and one of which was a route re-deriving it." }
]
```
