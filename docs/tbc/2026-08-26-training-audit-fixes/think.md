---
started_at: 2026-08-26T15:10:00+08:00
---

# THINK — Training-system post-ship audit fixes (§1.2 retrospective, §1.7 ground-up)

## Why (the record — §1.2)
After shipping the three training slices at speed, I ran an adversarial correctness audit (two independent reviewers)
over the diffs. It surfaced four CONFIRMED defects — each checked against the code before fixing (an audit finding is
a SUSPECT, not a fix). This is the §1.7/§1.2 pass catching what the fast build missed.

## The four confirmed defects + the fix
1. **F1 — "one focus per rep" was permanently EMPTY (the worst).** `teamTrainingBrief.ts` computed the active reps'
   real names but used them ONLY as the parse whitelist (`validSet.has(r.rep)`) — it NEVER passed them into the prompt.
   The LLM had no real names, so every `repFocus.rep` it produced was filtered out → `repFocus` always `[]`, the
   "One focus each" section never rendered. This fails the founder's explicit "one focus per rep" spec (layer-2,
   §1.5.4). FIX (grounded, not a paper-over): pass each active rep's OWN top growth area into the prompt (`repSignals`)
   so the per-rep focus is grounded in that rep's real signal — not the LLM guessing attribution from anonymized pooled
   data (§3.4). The whitelist now uses those same names, so a real focus survives. §A18 preserved: a growth DIRECTION
   per rep, never a grade/rank.
2. **F2 — a transient 5xx silently downgraded a MANAGER to the rep view.** `training/page.tsx` decided role by
   `res.ok`; any non-ok (including a 500) fell through to the rep fallback. FIX: ONLY a 403 (not-a-manager) falls back;
   a 5xx / network error is shown as an error, never a wrong-role view. (No tenant leak either way — the rep view only
   ever shows the caller's OWN data — but a manager shouldn't see "your trainings" on a blip.)
3. **F3 — `degraded:true` left the page on "Loading…" behind the error banner forever.** FIX: an explicit `error`
   mode clears loading; the banner shows alone.
4. **Practice Finding-1 — a fresh "Practice X" launch could resume a STALE conversation and score it against X.**
   `roleplay/page.tsx` recovery restored an in-progress roleplay unconditionally, ignoring `?focus=`; a plain resumed
   conversation then got tagged with focus X and scored against a skill it never practiced (§3.4 honesty smell) + the
   "Practice X" click didn't start practicing X (broken layer-3). FIX: when `?focus=` is present, skip recovery and
   drop the stale copy — a fresh practice always starts clean at setup with the banner. Also clamp the focus to the
   route's 600-char limit so a long focus can't 400 every turn (the reviewer's LOW dead-end note).

## Gate the lesson (A30)
F1 is the recurrence risk (a prompt that silently omits data the downstream filter requires). Added a guard test:
`buildTeamBriefUserMessage` MUST contain the repSignals' names — it fails if the names are dropped from the prompt again.

## Refuted (recorded — not fixed, correctly): the reviewers cleared parsePracticeReview clamp/double-parse, the
default no-focus roleplay path, empty-focus truthiness, my-training tenant scoping, the manager route gate,
parseTeamBrief honesty, the shared-panel extraction (no drift), and data-shape matching. Only the four above were real.

## Ripple (§6 item 5)
- F1 touches the brief prompt + engine + a test (no schema, no route change). F2/F3 touch the Training page's load()
  branch only. Finding-1 touches the roleplay page's mount effects only. The default roleplay path stays unchanged.

## Session-read manifest (A22 — read_at ≥ started_at 15:10:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-08-26T15:12:10+08:00",
    "why_it_governs": "Understand each defect from the code before fixing — a finding is a suspect.",
    "how_this_build_will_embody_it": "Verified all four against the source (and refuted the rest) before editing." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-26T15:12:12+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Cited axioms re-read this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-08-26T15:12:14+08:00",
    "why_it_governs": "F1 is a layer-2 failure (a specified feature that can't produce output); F2/F3/Finding-1 are layer-2/3.",
    "how_this_build_will_embody_it": "Grounded the per-rep focus in real signal; role-branch + recovery no longer strand or mislead the user." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-203", "read_at": "2026-08-26T15:12:30+08:00",
    "why_it_governs": "The founder specified 'one focus per rep' as part of the ask — F1 leaving it empty is a layer-2 miss, not deferrable polish.",
    "how_this_build_will_embody_it": "Treated F1 as a must-fix layer-2 defect and delivered the specified per-rep focus." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-08-26T15:12:32+08:00",
    "why_it_governs": "Diagnose from the record — check each audit finding against the actual code before fixing.",
    "how_this_build_will_embody_it": "Confirmed all four against source (and refuted the rest) before editing." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-235", "read_at": "2026-08-26T15:12:34+08:00",
    "why_it_governs": "Ground-up post-ship audit of freshly-shipped code.",
    "how_this_build_will_embody_it": "Ran two independent adversarial reviewers over the diffs and fixed the confirmed flags." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-148", "read_at": "2026-08-26T15:12:16+08:00",
    "why_it_governs": "Proactive audit — THINK then search; the reviewers are the search, this is the fix.",
    "how_this_build_will_embody_it": "Ran the adversarial audit proactively post-ship and fixed what it confirmed." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-367", "read_at": "2026-08-26T15:12:18+08:00",
    "why_it_governs": "Honesty — no ungrounded per-rep attribution; no score for an unpracticed skill.",
    "how_this_build_will_embody_it": "F1 fix grounds repFocus in each rep's own signal; Finding-1 fix stops scoring a stale conversation against a fresh skill." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-438", "read_at": "2026-08-26T15:12:22+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from the record, checked suspects, fixed at the right depth, gated the F1 lesson." },
  { "id": "§A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-08-26T15:15:00+08:00",
    "why_it_governs": "F1's per-rep line must stay a growth direction, not a leader-facing ranking.",
    "how_this_build_will_embody_it": "repSignals is each rep's growth DIRECTION; the prompt still forbids grades/ranks." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-26T15:12:20+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-597", "read_at": "2026-08-26T15:12:24+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-26T15:12:26+08:00",
    "why_it_governs": "Gate the lesson — a prose fix returns.",
    "how_this_build_will_embody_it": "Added a guard test that fails if the prompt drops the per-rep names again (F1)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-26T15:12:28+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
