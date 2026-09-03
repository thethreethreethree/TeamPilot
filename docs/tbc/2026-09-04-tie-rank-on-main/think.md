---
started_at: 2026-09-04T07:46:49+08:00
---

# THINK — competition ranking, rebuilt on top of main

## Why this is a second build and not a rebase

The founder's decision `tie-shares-both` (4 Sep) was built on the branch `tie-shares-rank`. While it waited for
review, `main` moved **22 commits**, and three of the files that branch touches changed underneath it —
`Scoreboard.tsx` (my own band fix), `weeklyDigest.ts` and its test.

A rebase would have handed the owner a three-file conflict in a component two sessions had edited, in the middle of
an App Store submission. My own remediate.md from the band build said what to do about exactly that: *"I would
rather redo the change on top of their version than have you untangle it by hand."* So this is the change
re-applied to current `main`, and the old branch is superseded.

## Understanding — the bug is still there, checked rather than assumed (§0)

`main` today, read line by line:

- `Scoreboard.tsx:153` — `RANK_ACCENT[i]` and `{i + 1}`. The row INDEX is the rank.
- `leaderboard/route.ts:40` — `meRank: meIndex >= 0 ? meIndex + 1 : null`.
- `weeklyDigest.ts:83` — `const rank = i < 3 ? medal[i] : …`, and `:128` the same in the plain-text list.

So of two reps on an identical total, one is told they came second — on the board, in the number the API hands out,
and in the manager's weekly email. That is false, and it is the kind of thing a person remembers being told.

The other session did not touch ranking, so nothing about the decision has changed.

## What is DIFFERENT from the superseded branch (§3.2.1)

The change itself is the same, deliberately — this is a re-application, not a redesign. One thing is new, and it is
there because a mutation found a hole the first build had:

**Reverting `Scoreboard.tsx` to `{i + 1}` passed every test in the repo.** Nothing renders that component, so the
shared module can be perfect while the board beside it ranks by position again. The first build shipped with that
hole; this one closes it with a narrow source-level check over the two render surfaces.

That is the same shape as the band-boundary gate added earlier today, and for the same reason: a rule with one
definition, re-derived at a render site, is invisible to behavioural tests because both copies pass their own.

## Four layers (§1.5.1)

1. **Structure.** One pure module, three consumers. No re-derivation.
2. **Operational.** The board, the API's `meRank` and the digest agree for the same rows.
3. **The person.** Nobody is told they lost a tie they did not lose — including in an email to their manager.
4. **Finish.** The podium accent follows the rank, so two reps tied for first both read as gold.

## What could go wrong, before searching (§1.5.2)

- **The other session may have fixed ranking already**, making this redundant. Checked all three sites on `main`:
  it has not.
- **`bandForWire` and the rank change may collide** in `Scoreboard.tsx`. They do not — one computes a chip colour
  from `avg_points`, the other a place from `total_points`, and neither reads the other.
- **The digest tests may have changed on main.** They have; the tie tests were carried across and re-run against
  the current file rather than assumed to apply.

## Session-read manifest (§3.1.2 / A22 / A35)

Re-opened for THIS build, not carried from the superseded branch.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "Understand before solving: whether the bug is still there at all, after 22 commits.",
    "how_this_build_will_embody_it": "All three sites on main were read line by line before anything changed; think.md quotes them with line numbers." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "The methodology must be in the tree at the moment of action.",
    "how_this_build_will_embody_it": "Re-opened for this build after its started_at." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "Walked in think.md; L3 is the reason the decision was made." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-152", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "Think first, then search to confirm.",
    "how_this_build_will_embody_it": "Three hypotheses written before searching; the third — that the digest tests had moved — was right, and they were re-run rather than assumed." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-452", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "The checklist, item 3: am I repeating a failed approach?",
    "how_this_build_will_embody_it": "A rebase was the failed approach here; this is the redo I had already written down as the alternative." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-468", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "A cited label without its content is the canonical failure.",
    "how_this_build_will_embody_it": "Every asset below was opened at its range in this build's window." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-542", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "Cross-module: the same concept under two names.",
    "how_this_build_will_embody_it": "'A place shown to a rep' spans the board, the API and the email; all three are checked in check.md." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "This build's reads are its own, not carried from the superseded branch." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-703", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "A reported bug is one instance of a class, swept to its boundary.",
    "how_this_build_will_embody_it": "The class is 'a place derived from a row index'. Swept again on current main, because 22 commits could have added a fourth site. They did not." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "Encode the class in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The new source-level check is exactly this, and it was added BECAUSE a mutation showed the first build's gate did not cover the render surface." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-806", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "The seam between the data and what a person sees.",
    "how_this_build_will_embody_it": "The seam is the component: correct module, wrong render, and no test in between. Now gated." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-866", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "A gate must be PRECISE or not exist.",
    "how_this_build_will_embody_it": "The check reads two named files with comments stripped and allows the legitimate `ranks[i] ?? i + 1` fallback, so it cannot fire on correct code." },
  { "id": "A35", "source_file": "ThinkerThinker.md", "line_range": "900-912", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "The hook charges for the citation, not the reliance.",
    "how_this_build_will_embody_it": "The minimum set is present whether or not the prose quotes it." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-936", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "Read the residual from the top of the confidence ranking.",
    "how_this_build_will_embody_it": "The high-confidence entry was opened before closure." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-04T07:49:41+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the canonical gate, and reports the two mutations that came back MISSED — one a real hole, one an invalid mutation of mine." },
  { "id": "§3.1.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "119-160", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "Defines this manifest; read_at must be this session.",
    "how_this_build_will_embody_it": "Re-opened after this build's started_at." },
  { "id": "§3.2.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "223-228", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "Deviating from the request is a violation; flag before acting.",
    "how_this_build_will_embody_it": "The change is a re-application, not a redesign. The one addition — the render-surface gate — is flagged in think.md as the difference and why." },
  { "id": "§3.2.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "229-262", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "Write path and read path, both asserted.",
    "how_this_build_will_embody_it": "build.md names the row a rep reads and the email a manager opens." },
  { "id": "§3.2.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "263-292", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "Run the canonical command by name.",
    "how_this_build_will_embody_it": "check.md leads with npm run check and its exit code." },
  { "id": "§3.3.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "298-301", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "Audit the built files, not the intent.",
    "how_this_build_will_embody_it": "main's three sites were read before the change, and the digest tests re-run against the current file." },
  { "id": "§3.3.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "302-313", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "A CHECK with no cross-module pass is incomplete.",
    "how_this_build_will_embody_it": "Board, route, digest and the mobile app, tabulated." },
  { "id": "§3.3.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "314-330", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "Name the class by its root shape; record the command.",
    "how_this_build_will_embody_it": "Recorded, and re-run on current main rather than trusting the earlier sweep." },
  { "id": "§3.3.4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "331-345", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "Gate or promise, per fix.",
    "how_this_build_will_embody_it": "Answered in remediate.md; the new gate is the answer to the hole the first build left." },
  { "id": "§3.3.5", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "347-352", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "Never report clean for what was not inspected.",
    "how_this_build_will_embody_it": "The rendered board with a real tie is named as un-inspected and carried into the residual." },
  { "id": "§4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "418-457", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "The residual is a queue read from the top.",
    "how_this_build_will_embody_it": "Two entries; the high-confidence one opened before closure." },
  { "id": "§6.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "515-528", "read_at": "2026-09-04T07:49:49+08:00",
    "why_it_governs": "The gate that reads this manifest.",
    "how_this_build_will_embody_it": "Ranges checked to contain their ids." }
]
```
