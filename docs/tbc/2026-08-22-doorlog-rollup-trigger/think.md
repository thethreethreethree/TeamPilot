---
started_at: 2026-08-22T08:34:00+08:00
---

# THINK — Next Door focus never generated: fix the trigger + backfill (founder 2026-08-22)

## Diagnosis (proven from the record, not guessed)

Reps used the app all day but the Next Door focus stayed empty. Traced:
- The focus = `rep_pattern_summaries.patterns_bad[0]` (a rollup of analyzed pitches). Live DB: **0 rows, ever** —
  despite **42 analyzed pitches** with real improvements.
- Ruled OUT, one by one: no-data (42 exist), suppression (rollup is `controlExempt`), token-starvation (the
  DeepSeek provider adds reasoning headroom), missing DB constraint (the `unique(rep_id,period,period_start)`
  exists), and the LLM itself — **reproduced the exact rollup call against the 42 real pitches: HTTP 200, valid
  JSON, real patterns.** So the LLM + parse + write are all sound.
- Therefore the failure is the **TRIGGER**: the rollup ran ONLY in the cron's separate "rollup pass"
  (`rollupDueReps`), and it never successfully populated the table — while pitches still reached `complete` via
  the route's fire-and-forget `after()` kick. The sole trigger was fragile, and its failure was **silent** (the
  per-period catch swallowed everything). §1.2 retrospective + §2 (a repeat "nothing generates" report means the
  identification/trigger was wrong).

## Fix

1. **Durable trigger (the "never again").** The worker now kicks `rollupRep` from the pitch-**completion** path
   via `after()` — the SAME reliable mechanism that processes the pitch — so the focus refreshes on EVERY
   completion (route kick AND cron), not only the cron's separate pass. The cron pass stays as a backstop.
2. **Visibility (A30/INV22).** The rollup's per-period catch now LOGS instead of swallowing silently — the
   silence is why an empty focus hid despite analyzed pitches.
3. **Backfill (founder-authorized, already run).** Generated the rollups for all 4 reps with complete pitches
   (16 summaries, day/week/month/all_time) via the proven prompt + service role → the Next Door focus + growth
   opportunities now render for existing data. (Recorded in the closure.)

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "Understanding precedes solving — I proved the LLM/data/write work before fixing, isolating the trigger.",
    "how_this_build_will_embody_it": "The fix targets the proven cause (fragile sole trigger), not a guess." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A19/A22/A30/A38 via Read this turn (08:35)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "44-52", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "Retrospective identification — diagnose from the actual record, not by theorising forward.",
    "how_this_build_will_embody_it": "Diagnosed from the live DB (0 summaries / 42 pitches) + a real LLM reproduction." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "205-235", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "No error loops — a repeat 'nothing generates' report means the identification/trigger was wrong.",
    "how_this_build_will_embody_it": "Instead of re-patching, isolated the trigger as the cause and fixed it at the completion path." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "Layer-2 — a feature (the focus) that never produces content has not delivered its result.",
    "how_this_build_will_embody_it": "The focus now generates on completion + is backfilled for existing data." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "Proactive audit — verified the sibling surfaces (Score Chart, Pitch Performance) are populated too.",
    "how_this_build_will_embody_it": "Confirmed 42 summaries + v2 score dims populate; fixed the one gap (focus)." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: proved cause from the record, traced ripple (cron backstop kept), stated why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this turn." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "Encode the lesson in a gate; make silent failure visible.",
    "how_this_build_will_embody_it": "A test locks the completion-path rollup kick; the swallowed catch now logs." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T08:35:27+08:00",
    "why_it_governs": "'Verified' names the command you ran — and the proof (a real reproduction) behind the diagnosis.",
    "how_this_build_will_embody_it": "Ran the full npm run check; the backfill was verified against the live table." }
]
```
