---
started_at: 2026-09-21T12:40:00+08:00
trigger: 4,537 green tests described a system that had never scored a real pitch. The engine and the writer both existed and nothing called either.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the last build's residual R2, closed

## Why (the record)

The previous build (`docs/tbc/2026-09-21-pitch-score-persistence`) closed with residual R2:

> *"generatePitchScore and storePitchScore both exist, are tested, and have no caller. No route,
> no job, no trigger. Project 1 is not operable. 4,497 green tests describe a system that has
> never scored a real pitch."*

A36 says the residual is the highest-yield queue in the audit and that writing it as a disclaimer
is what stops you returning to it. This is returning to it, immediately, rather than moving on to
Project 2 with Project 1 unreachable.

It also unblocks the launch gate the build guide sets: *"run 10 to 20 real recordings through the
scorer and have a manager grade the same pitches by hand. Ship when they agree on most elements."*
That cannot start without a way to run a recording through the scorer.

## Outside view (§1.3): what does a route like this get wrong?

The temptation is to treat it as plumbing — read the session, call the engine, call the writer,
return JSON. Plumbing is where the silent defects live, because every one of them **succeeds**.

Hypotheses formed before reading the session shape, then checked against it:

1. **Whose score is it?** If the route writes `rep_id = auth.user.id`, a manager reviewing a rep's
   recording files the score against themselves. **Confirmed a real risk** — `SalesSession` has
   `agentId`, distinct from the caller, and managers can read other reps' sessions by design
   (0083/0084). The leaderboard would inflate for managers and stay empty for reps, and nothing
   would error.
2. **When was it?** If `recorded_at = now()`, an upload processed days after the call lands in the
   wrong week. **Confirmed** — this product has shipped exactly this bug before ("a call recorded
   on the 4th was filed as happening on the 11th"), which is also why `generatePitchScore` derives
   its transcript offsets from the first timed segment rather than wall-clock.
3. **Is every session a pitch?** **Confirmed a real risk** — `session_kind` is
   `'sales' | 'meeting' | 'huddle'` (0237). Grading a team huddle against a door-to-door rubric
   produces a real-looking low score for a conversation that was never a pitch, and it would drag
   a rep's average down.
4. **Do the vocabularies match?** **Confirmed, and this one is a hard failure** — `SalesOutcome`
   has five values (`sold`, `follow_up`, `no_sale`, `no_contact`, `undecided`); `pitches.outcome`
   allows three. Forwarding `no_contact` violates the CHECK and loses the **entire write** after
   the LLM call has already been billed — A40's fourth question exactly.
5. **How long was it?** `audioDurationSeconds` is the real audio length from the transcription
   word timestamps (0210); `startedAt..endedAt` for an upload is when the file was *processed*.
   Preferring the wrong one misreports pitch length on every uploaded recording.

Five hypotheses, five confirmed. None would fail a test written from the happy path.

## The mapping decision (4) is not cosmetic

`no_contact` could have been mapped to `no_sale` to avoid a null. That would be wrong in a way
that matters: a door nobody answered is not a lost sale. §3.5 names completion/resolution rate as a hard,
defensible metric and forbids measuring the convenient thing in place of the real one. The
sold-rate is this domain's completion rate. Folding unanswered doors into `no_sale` would make it
count doors nobody opened as pitches that were lost.
Null is the honest value: the outcome is unknown to this table's vocabulary.

## Layers (§1.5.1)

1. **Structure** — the route decides nothing about scoring; it resolves *whose*, *when*, *whether*
   and *what kind*, then hands off. `readPitchScore` is a sibling of `storePitchScore` in the same
   folder rather than a query inlined in the route.
2. **Effectivity** — POST scores and stores; GET reads back. Both gated on `getSession`, which is
   the owner-or-manager RLS check, so a same-company peer rep cannot score or read another rep's
   recording (the IDOR shape this route family has been bitten by).
3. **Composition** — this is the join. What comes before it is a finished session with a
   transcript; what comes after is the Pitch detail screen, which does not exist yet. The GET
   distinguishes *"you may not see this"* (404) from *"nothing has scored it yet"* (200 + null)
   precisely so that screen can offer a Score button in the second case and nothing in the first.
4. **Surface** — none. No UI in this build; that is the next one.

## Bearer-reachability is a layer-2 requirement here, not a nicety

Reps are on phones. A phone sends a Bearer token and no cookies, so a cookie-only route 401s every
rep. Both handlers resolve `callerScopedDb(req) ?? createClient()` and pass that client **through**
to every read — including `readPitchScore`. Scoped for identity and anonymous for the read is the
F22/F33 shape that has cost this codebase five separate defects, and on this surface it would
produce an honest-looking *"not scored yet"* for a pitch that exists.

## Session-read manifest

Every clause below was opened in THIS session, from the file named, at the line range given.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving; the problem must be understood before the fix is written.",
    "how_this_build_will_embody_it": "Five hypotheses about how a plumbing route fails silently were formed BEFORE the session shape was read, then checked against it. All five were real. Writing the route first and testing the happy path would have shipped all five." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The governing methodology must be in the tree and read now, not cited from cached labels.",
    "how_this_build_will_embody_it": "Same standing gap as the previous build: the Pitch Score implementation guide is not in the tree. Carried forward unchanged as residual R4, and it bears directly here because the SCORING TRIGGER (on finalize vs on demand) is exactly the kind of decision that guide may already have made." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-63", "read_at": "2026-09-21T13:15:00Z",
    "why_it_governs": "Examine the problem as a detached observer with no stake in the existing assumptions; actively counter tunnel vision.",
    "how_this_build_will_embody_it": "The stance that produced the five hypotheses. From inside the work this was 'the last easy piece of Project 1'; the outside question — what does a route like this get wrong? — is what turned five pieces of plumbing into five confirmed defects." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Everything is an event, append-only; entity state is derived by replaying them.",
    "how_this_build_will_embody_it": "Carried from the sibling build, where it is the clause store_pitch_score does NOT satisfy (it deletes children on re-score). This build adds no new tension with it: the route writes through that same RPC and introduces no further deletes." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — trace what else a change affects before making it.",
    "how_this_build_will_embody_it": "The route touches nothing existing: a new path, a new reader, no change to the dissect route it sits beside. The ripple that DID need tracing was the outcome vocabulary mismatch between coaching_sessions and pitches, which is invisible until a no_contact session is scored." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Four layers, foundation up; layer 3 asks whether the completed feature leaves the user able to continue.",
    "how_this_build_will_embody_it": "The GET distinguishes 404 from 200-with-null specifically so the next surface can tell 'you may not see this' from 'nothing has scored it yet' and offer the right next action. Layer 4 is absent and named as absent." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first about what could fail, THEN search to confirm; five sharp findings beat fifty from grep.",
    "how_this_build_will_embody_it": "This build IS that loop: five hypotheses formed first, then checked against SalesSession and migration 0252, five confirmed. Quality over quantity — none came from pattern-matching, each has a named consequence." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Consume the authority's verdict; do not re-derive a decision from the raw inputs it already judged.",
    "how_this_build_will_embody_it": "The route branches on generatePitchScore's explicit ok/failure verdict rather than inspecting the score for emptiness, and readPitchScore returns the stored section verdict rather than re-summing element rows — which is the one way the read side could have undone 0254." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T12:45:00Z",
    "why_it_governs": "Hard metrics must be OBJECTIVE and DEFENSIBLE — completion/resolution rate is named as one — and measuring the convenient thing instead of the consequence is grading your own homework.",
    "how_this_build_will_embody_it": "no_contact maps to NULL, not to no_sale. The sold-rate is this domain's completion rate, and folding unanswered doors into lost sales would have avoided an awkward null at the cost of a metric that no longer measures what it claims." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "The biggest risk is the builder under pressure making it less honest for a faster result.",
    "how_this_build_will_embody_it": "30 route tests passed on the FIRST run, which is the moment to distrust rather than to ship. Six mutations were introduced and all six failed a test; without that step 'the tests pass' would have meant nothing here." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "Item 0 — a decision offered to the founder must be a picker with a recommendation, never prose.",
    "how_this_build_will_embody_it": "One founder decision is surfaced and NOT taken in prose: whether scoring runs automatically on session finalize or stays on-demand. It is residual R1 and reserved for a picker, because auto-scoring every session spends an LLM call per call." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Holding the labels without the content produces work written in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "The route's docblock cites F22/F33 and §3.5; both were checked against the tree in this session rather than recalled — §3.5's line range was read specifically to confirm the sold-rate claim before the outcome mapping leaned on it." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "This session was resumed from a compacted context. Every clause cited across both of today's builds was re-opened from the tree today." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "A lesson in prose returns; encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Each of the five hypotheses is a test that asserts what was WRITTEN, not what was returned — repId, recordedAt, durationS, outcome, sessionKind — because all five produce a 200 and a plausible score." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-944", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "The residual is the highest-yield queue, and writing it as a disclaimer is what stops you returning to it.",
    "how_this_build_will_embody_it": "This build exists because the previous build's R2 was read back and acted on immediately instead of being left as an honest note while work moved to Project 2." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "'Verified' is a claim about a command you ran, in the words of the project's own gate.",
    "how_this_build_will_embody_it": "check.md names each command, gives its count, and states what was not run and what has no UI." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1052", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "The verdict pattern, including: when the authority runs an expensive side effect before returning, a consumer that then discards the result burns the cost for nothing.",
    "how_this_build_will_embody_it": "Question 4 is the outcome mismatch. Forwarding no_contact fails the CHECK and loses the write AFTER the LLM call is billed. It is also why the session-kind refusal happens BEFORE the LLM call rather than after." }
]
```
