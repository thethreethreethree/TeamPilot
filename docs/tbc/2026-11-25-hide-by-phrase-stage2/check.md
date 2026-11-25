# CHECK - A hidden call's remaining rows, and a list of hidden calls (stage 2a)

## Commands

```
node fkscan.mjs (PGlite 0001–0338) → 28 tables reference coaching_sessions, 6 reference pitch_scores; 7 carried the 0337 guard
node replay0339.mjs (signed in) → hidden, 0337/0338 only — manager: tracker_hits=1 session_intera=1 library_items=1 recording_comm=1 · hidden + 0339 — manager: all 0 · rep: tracker_hits=1 session_intera=1 after_pitch_su=1 coaching_cues=1 library_items=1 manager_notifi=1 pitch_score_ev=1 pitch_score_ov=1 recording_shar=1 · admin: tracker_hits=1 session_intera=1 coaching_cues=1 library_items=1 pitch_score_ev=1 pitch_score_ov=1 recording_comm=1 recording_shar=1 (pitch_score_elements and transcript_line_edits rows didn't fill in the replay; same rule)
npm run db:apply → applying 0339_hide_by_phrase_stage2.sql … ok · ALL 33 invariants hold
npx vitest run hidePhrases lib + library + shared → first ✗ the shared "no reads" test (the hide check now reads call_hides) → asserts only call_hides is read → 19 passed
npx vitest run hide-phrases route → 7 passed
```

## Findings

### F1 - stage 1 left a hidden call's comments, hits, stats and library items readable
class: a restrictive rule on a parent table doesn't reach child tables with their own read rules.
sweep: every table with a foreign key to coaching_sessions or pitch_scores listed from the replayed schema; content-bearing ones guarded in 0339; the rest (points, calibration, listen/share counters without words, prospect links, failures) recorded as not hidden.
severity: high

### F2 - a hidden call could be stranded after its phrase was retired
class: a list derived only from active phrases loses rows whose phrase was retired.
sweep: the hidden-calls list is derived from active hides, whatever the phrase's state (tested with a retired phrase).
severity: medium

### F3 - the hide check was one database call per call
class: a per-item remote call inside a list check.
sweep: one read of call_hides first; the SQL rule only for calls with a hide row (tested: two of four asked).
severity: low

## Final

```
npm run check → exit 0 · Test Files 944 passed | 1 skipped · Tests 6853 passed | 15 skipped
```
