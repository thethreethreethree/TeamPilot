# Audit — derived data with no automatic trigger

**Run:** 2026-09-24 · **Scope:** the class behind John Knudtson's report that the manager dashboard
shows no recordings · **Standard:** this repository's own governing documents, substituted for the
BUILD-STARTER V6 filenames named in the audit request, which are not in this tree.

---

## 0. What this was audited against

The audit request named `01-CONSTITUTION.md`, `03-ANTI-FAULT.md`, `FLAWFIXV1.MD`,
`00-START-HERE.md`, `06-VERIFICATION.md` and `node tools/gate.mjs`. **None of the six is in this
repository.** Auditing against them would have meant quoting a kit from memory, which is the
CAT-001 failure §0.1 exists to prevent. Substituted, with the founder's approval:

| Document | Size | Role |
|---|---|---|
| `CLAUDE.md` | 32,315 B | The constitution — §0, §1.5.1, §1.5.2, §1.7, §2.2, §6 |
| `ThinkerThinker.md` | 217,001 B | The anti-fault store — A19, A21, A26, A30, A31, A38 |
| `docs/BUILD-PROTOCOL.md` | 18,944 B | The build protocol (§2.1) |
| `docs/EVIDENCEPROTOCOL.md` | 6,947 B | R1–R7, reading as a gated phase |
| `docs/amendments/AMD-006-…md` | 29,353 B | The four-layer gate and the proactive-audit addendum |

Gate command: `npm run check` (twelve steps), not `tools/gate.mjs`.

### The clauses, quoted

**CLAUDE.md §1.5.1, layer 2 — operational feature effectivity:**

> **Operational feature effectivity** — does the feature, when invoked the way a real user /
> caller / consumer would invoke it, actually deliver the intended result? Not "does the unit test
> pass" — does it *work*, end-to-end? (The "does it actually work" layer.)

**CLAUDE.md §1.5.1 on ordering:**

> The order is a sieve: the worse the broken layer, the more structural the failure, the less the
> layers above can compensate.

**CLAUDE.md §1.5.2 — the proactive audit rule:**

> For every task — feature, fix, refactor — the agent's responsibility extends past "do the thing
> the founder asked" … **THINK first about what could be wrong or better.** … **Search for adjacent
> problems.** A bug rarely lives alone.

**ThinkerThinker.md A31 — the clause this audit is entirely about:**

> SCHEMA-COMPLETE IS NOT BUILT — the seam between the database and the surface is where a correct
> system silently becomes a nonexistent feature, and it must be gated, not watched.

> In one session I shipped **seven** features whose schema was correct, whose views were correct,
> and whose pages were correct — **and which could never have worked**, because nothing in the
> product could ever *write* the column they depended on. I had already reported three of them to
> the founder as `BUILT`.

**ThinkerThinker.md A26 — the sweep obligation:**

> The completion criterion for a fix is therefore NOT "this instance is fixed" but "the class is
> swept to its boundary — every instance fixed or confirmed intentional."

**ThinkerThinker.md A30 — why prose is not enough:**

> A lesson recorded only in PROSE will return — a fix is not complete until the class is encoded in
> a GATE that fails without the author's cooperation.

---

## 1. The class

> **A derived artifact whose generation is only ever triggered by a human deliberately asking for
> it — displayed on a surface that presents the data as accumulating on its own.**

This is distinct from what `writer:audit` already checks. That gate asks *"does any code write this
table?"* and answers yes for every table in the schema. The question it does not ask is *"does
anything call that writer without a person remembering to?"*

**[OBSERVED]** `npm run check` reports `Every table the product reads has something that writes it.`
and has reported that throughout. The hole is in the lens, not the data — A30's exact phrasing about
the 19 views.

---

## 2. Finding 1 — `pitch_scores` has no automatic writer, and five product surfaces terminate in it

**Severity: critical.** This is the live defect a partner reported.

**Evidence, each read from the file:**

- **[OBSERVED]** `pitch_scores` is written by exactly one function, `storePitchScore`
  (`src/lib/coach/pitchScore/storePitchScore.ts`, 9,972 B).
- **[OBSERVED]** That function is called from exactly one place:
  `src/app/api/coach/sales-session/pitch-score/route.ts:111` (10,408 B).
- **[OBSERVED]** That route is called from exactly one place:
  `src/components/sales-coach/PitchScorePanel.tsx:76` (10,823 B) — a `fetch(ENDPOINT, {method:"POST"})`
  inside `const score = async () => {…}`, wired to a button.
- **[OBSERVED]** That component is mounted at `src/app/dashboard/sales-coach/[id]/page.tsx:495` —
  the **individual session page**. One session, one human, one click.
- **[OBSERVED]** `vercel.json` registers **12** cron jobs. None of them scores a pitch.
- **[OBSERVED]** No session-close path scores either. There are three ways a sales session ends —
  `[id]/route.ts:145`, the `finalize` route, and `auto-close-stale-cron:71` — and none references
  the scoring path.

**The blast radius.** Ten modules read `pitch_score*`:

```
pitch-recordings/comment · pitch-recordings/share · pitch-score/best · pitch-score/dispute
pitch-score/disputes · pitch-score/override · patterns/readPatterns · pitchScore/readPitchPeriod
pitchScore/readPitchScore · recordings/readRecordings
```

The build plan (`EloState Coaching Build Plan — Engineering Guide.pdf`, opened at full page, 8 pp.)
states the dependency in its own flowchart and in prose:

> Build in this order. Each step unlocks the next: **nothing can display until pitches are scored**,
> and Pattern Interrupt needs timestamped scoring and the recording player.

So Projects 2, 3, 4 and 5 all rest on a table that fills only by hand. **[OBSERVED]** John's report
— *"Once it updates with past recordings I'll be able to have some more feedback"* — is the
predicted symptom, not a separate bug.

**The most damning part is in the code's own comment.** `pitch-score/route.ts:21`:

> This is the trigger Project 1 was missing: the engine and the writer both existed and nothing
> called them, so 4,497 green tests described a system that had never scored a real pitch.

The lesson was found, understood, and fixed — **as a button**. The class recurred one layer out
within the same feature. That is A30 with the receipt attached.

---

## 3. Finding 2 — Pattern Interrupt has never been able to open a pattern

**Severity: high.** **[OBSERVED]**, and it follows mechanically from Finding 1.

- `patterns` rows are created in exactly one place: `src/lib/coach/patterns/runDetection.ts:99`
  (6,997 B).
- `runDetection` is called from exactly one place: `pitch-score/route.ts:145`, *after* a score is
  stored.
- `patterns/event/route.ts` only **updates** patterns that already exist.

So Pattern Interrupt — Project 5, two manager screens and a rep screen in the build plan — can only
find a habit if a human first hand-scored ten pitches for that rep. **[INFERRED]** in production
that count is zero, so every Pattern Interrupt surface renders its empty state.

The route's own comment anticipated the honesty problem and not the reachability one:

> This is that hook, and it is the line that makes Pattern Interrupt's empty state honest — without
> it the board says "nothing has been missed in 3 or more of your last 10 pitches" when nothing has
> looked.

The hook is correct. Nothing pulls it.

---

## 4. Finding 3 — two different things are called "pitch" (A21)

**Severity: medium.** **[OBSERVED].**

| | `pitches` (0215) | `pitch_scores` (0252) |
|---|---|---|
| What it is | a door-knock recording | a rubric grading of a sales session |
| Processing | `pitch-processing-cron`, **every minute** | none |
| Recovery net | `recover-transcripts-cron`, hourly | none |
| Status machine | `pitch_status` enum, 6 values | n/a |

A reader who learns "pitches are processed automatically every minute" has learned something true
about one table and false about the other. **[INFERRED]** this naming collision is part of why the
gap survived: the system *does* have a pitch pipeline, and it is not this one.

---

## 5. Finding 4 — the codebase already solved this class, for a different table, two weeks ago

**Severity: high**, as a process finding rather than a code one. **[OBSERVED].**

`src/app/api/coach/sales-session/recover-transcripts-cron/route.ts` (2,891 B) exists because of an
incident with the identical shape:

> On 10 September 2026 production held nine sessions with saved audio and no transcript at all —
> one of them the founder's 149-second test from that morning, the oldest from 25 July. Every one
> had `auto_recover_attempted_at = null`: **nothing had ever tried.** A rep does not go back to a
> call that showed them nothing, so **an on-open trigger alone would have left all nine exactly
> where they were.**

Substitute "manager" for "rep" and "score" for "transcript" and that paragraph describes Finding 1
exactly. The fix was applied to transcripts and not generalised, which is A26's completion criterion
unmet.

It also hands the remediation its design. The same file:

> a backlog drains over several hours rather than one unplanned bill … the sweep is the net under it
> rather than the mechanism it depends on.

`CRON_CAP = 6`, `maxDuration = 300`.

---

## 6. The sweep and its boundary

**Boundary:** all 12 registered crons mapped to what they drive, plus every generation-shaped API
route, plus the writer of each derived table the product reads.

```
$ python -c "…json.load(open('vercel.json'))…"    → 12 crons
$ find src/app/api -type d -name "*cron*"          → 12 directories (all registered — no dead cron,
                                                     no unregistered one)
```

| Derived artifact | Primary trigger | Net | Verdict |
|---|---|---|---|
| Door-log pitch transcribe/analyze | door-log route `after()` | `pitch-processing-cron`, 1 min | covered |
| Session transcripts | upload path, unconditional | `recover-transcripts-cron`, hourly | covered |
| Session dissects | `finalize` route (`generateSessionArtifacts`) | `backfill-dissects-cron`, 3 h | covered |
| Rep rollups | — | `pitch-processing-cron` (`rollupDueReps`) | covered |
| KPIs | — | `kpi/compute-cron`, daily | covered |
| Team briefs | — | `team-brief-cron`, daily | covered |
| Weekly digests | — | `weekly-digest-cron`, weekly | covered |
| Task overruns | — | `task-overrun-sweep-cron`, daily | covered |
| Durability checks | — | `durability-sweep-cron`, hourly | covered |
| Session auto-close + stitch | — | `auto-close-stale-cron`, 15 min | covered |
| Recording purge / RCD retention | — | two crons, daily | covered |
| **Pitch scores** | **a manager's button, one session at a time** | **none** | **FINDING 1** |
| **Patterns** | **inside the pitch-score route** | **none** | **FINDING 2** |

**Eleven of thirteen derived artifacts have an automatic trigger. The two that do not are the two
the partner is waiting on.**

### What the sweep did not cover

**[ASSUMED]**, stated rather than glossed:

- Tables written only by SQL (`Written by SQL only: 30`, per `writer:audit`) were not individually
  traced to a trigger. A trigger-function write is automatic by construction, so the risk is low,
  but it was not verified row by row.
- "Natural-flow" writers — a comment written when a manager writes a comment — were classified by
  reading the call site, not by tracing every UI path to it.
- The audit covers *whether* something triggers a write, not whether the write is *correct*.

---

## 7. Coverage map

**Inspected, file by file:** `vercel.json`; all 12 cron route directories (entry imports read); the
pitch-score route in full; `storePitchScore`; `runDetection`; `readRecordings`; `keyMoments`;
`PitchScorePanel`; `finalize`; `recover-transcripts-cron`; `claimPitchesToProcess` and
`setPitchStatus` in `src/lib/data/doorlog.ts`; `worker.ts`; migrations 0008, 0042, 0193, 0215, 0252,
0254, 0256; the build-plan PDF at full page; `CLAUDE.md`, `ThinkerThinker.md` and AMD-006 at the line
ranges cited.

**Not inspected:**

- The other six PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/` — the manager-dashboard board,
  the rep dashboard, the scoring rubric, and three Pattern Interrupt boards. Findings 2 and 3 touch
  surfaces those boards specify, so **this audit cannot say whether those screens match their
  designs.** One board was opened two days ago and had five unbuilt parts in the quarter of the page
  the founder happened to screenshot.
- Production data. Every "in production this is zero" statement here is **[INFERRED]** from the code
  path, not read from the database. Nothing in this audit queried the live system.
- The 30 SQL-only-written tables, individually.
- Every surface in a real browser except the Recordings panel.
- The four-layer (AMD-006) pass over this session's recent commits — that was the second half of the
  audit request and is deliberately not attempted here; the founder chose the sweep first.

---

## 8. Remediation plan

| # | Fix | Clause satisfied | Risk it introduces |
|---|---|---|---|
| 1 | Score on session close: call the scoring path from `finalize`, reusing its existing "already generated?" marker pattern so it is idempotent. Cover the other two close paths (`[id]/route.ts:145`, `auto-close-stale-cron`) or route them through the same helper. | §1.5.1 L2; A31 | Every closed sales session becomes one LLM grading call. Predictable per-pitch, unbounded per-day. A slow scorer must not delay the close response — fire after the response, never inside it. |
| 2 | One-pass backfill of unscored sessions, chunked internally so it survives the 60 s function ceiling and resumes rather than half-completing. Report per-reason counts. | A26 (the backlog is the same class) | Cost is the whole history at once — the founder chose this over the capped-cron pattern the codebase uses elsewhere, and that trade is recorded here rather than silently re-decided. |
| 3 | Make `suppressed` loud. If the §3.4 control gate declines, the backfill must report *"0 scored — AI guidance is off for this account"*, never a bare `0`. | §1.5.3 (fail loud, not silent); §2.2 | None. It is a message, not a behaviour change. |
| 4 | Re-run pattern detection for reps whose scores the backfill creates, so Project 5 is not still empty afterwards. | A26 | Detection reads `pitch_score_elements`; it must run after the scores land, not alongside. |
| 5 | Rename in prose, not in schema: document that `pitches` and `pitch_scores` are different objects, at the top of each. | A21 | None. A rename in the schema would be a large, risky migration for a documentation problem. |
| 6 | **Gate the class.** Extend the reachability audit to flag a table that a product surface reads, whose only writer is reachable solely from a component event handler. | A30 | False positives on tables that *should* be user-triggered (comments, overrides, disputes). Needs an explicit allowlist with a reason per entry, or it becomes noise and gets ignored — which is worse than no gate. |

**Item 6 is the one that stops this recurring**, and it is the one I would most expect to get wrong
on the first attempt. The others fix the instance; only 6 fixes the class, and A30 is explicit that
the instance fix alone does not count as complete.

Items 1 and 2 are already approved by the founder via picker (score on close; one pass). Items 3–6
await a go.
