---
started_at: 2026-08-27T06:20:00+08:00
---

# THINK — "View session not working": show rep USAGE, not just recent audio recordings

## The report + the diagnosis (from the record, not a guess — §1.2)
Founder (urgent): "The view session is not working. 3 guys consistently using it — Alejandro Salazar, Knute Knudtson,
Anthony — aren't showing up. Fix it so I can monitor their usage."

I INSTRUMENTED before fixing (`scripts/diag-view-session.mjs`, read-only) — ground truth:
- Knute Knudtson, Anthony a, John Knudtson: in company "Align Sales Pros" (28203036), active members, with 44 / 53 / 9
  sessions in the last 30 days — but EVERY session has `audio_asset_url = null` and NONE in the last 2 days.
- The manager view (`/api/coach/sales-session/recordings`) hard-filters `.not("audio_asset_url","is",null)` AND
  (created_at within 2 days OR saved). So these reps' sessions match NEITHER condition → the manager sees nothing.
- Alejandro Salazar is in a DIFFERENT company ("ASP", b2feb3b2) with 0 sessions — he cannot appear in the Align Sales
  Pros roster at all (a setup issue, not a code bug).

Root cause: the "view session" surface conflates RECORDINGS (stored audio) with USAGE. A rep who uses the product but
whose captures left no stored audio (the iOS capture class, since fixed for new sessions) or whose sessions aged past 2
days is invisible — so the manager cannot monitor usage. This is a §1.5.1 layer-2 failure: the feature does not deliver
its intended result ("monitor usage") for real reps.

## The fix (§1.5.1 layer 2 — make it actually work)
- `rep-activity` route: a rep's recent SESSIONS over 30 days, REGARDLESS of audio, with `hasAudio` as an attribute
  (+ saved). Same manager+same-company authz as `/recordings`. This is the usage view.
- `team-activity` route: per-rep session count + last-active over 30 days (one company-scoped read, aggregated in code)
  for the roster, so the manager sees who's using it at a glance.
- The manager Sessions view now shows each rep's activity in the roster and their recent sessions on open (with a
  "recording"/"no recording" tag + Save where audio exists). The old audio+2-day `/recordings` endpoint is untouched.

## §A18 — the label is the defense
Usage is ACTIVITY (session count / last active / a session list), rendered UNSORTED (alphabetical roster), never a
ranking or a performance grade. Founder session-monitoring is the sanctioned use; the label keeps it activity, not a
leaderboard.

## §3.4 honesty
A rep with no sessions in 30 days reads "No sessions in the last 30 days" (honest empty), never a false zero; a failed
read shows an error, never "no sessions". Only sessions with real audio show the recording tag / Save.

## Flag (NOT silently fixed): Alejandro Salazar is in company "ASP", not "Align Sales Pros"
Moving a user between companies (or merging a duplicate account) is a data change + a founder decision — surfaced, not
done unilaterally. He has 0 sessions under ASP; he needs to be added to Align Sales Pros to appear + start recording.

## Ripple (§6 item 5)
Two new read-only routes + a manager-view rewrite. The `/recordings` endpoint, the save-recording flow, and the rep
self-view are unchanged. No schema. Verified against REAL prod data (Knute: 0 → 44 sessions in the new view).

## Session-read manifest (A22 — read_at ≥ started_at 06:20:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T06:24:02+08:00",
    "why_it_governs": "Understand WHY the reps don't show before fixing — diagnose, don't theorize.",
    "how_this_build_will_embody_it": "Instrumented the real data first; the fix targets the confirmed audio+2-day filter, not a guess." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T06:24:20+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh for this fix." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-08-27T06:24:04+08:00",
    "why_it_governs": "Retrospective identification — look backward at the actual record.",
    "how_this_build_will_embody_it": "A read-only diagnostic over the reps' real profiles + sessions found the audio/2-day exclusion." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-92", "read_at": "2026-08-27T06:24:06+08:00",
    "why_it_governs": "Layer 2 — does the feature actually deliver 'monitor usage' end-to-end?",
    "how_this_build_will_embody_it": "The usage view shows every session (any audio), verified against real data (0 → 44)." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "144-146", "read_at": "2026-08-27T06:24:12+08:00",
    "why_it_governs": "Proactively THINK what else the surface gets wrong, not just the literal symptom.",
    "how_this_build_will_embody_it": "Beyond the 3 reps, found the class (audio+2-day filter hides ALL no-audio usage) and fixed the class; also flagged the adjacent Alejandro cross-company issue." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T06:24:08+08:00",
    "why_it_governs": "Honesty — no false empty.",
    "how_this_build_will_embody_it": "Honest 'no sessions in 30 days' vs an error state; recording tag only where audio truly exists." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T06:24:22+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from data, fixed at layer 2, §A18 label, flagged the Alejandro data issue rather than silently changing it." },
  { "id": "§A18", "source_file": "ThinkerThinker.md", "line_range": "431-432", "read_at": "2026-08-27T06:24:10+08:00",
    "why_it_governs": "Surfacing behaviour data to a leader — the label is the defense.",
    "how_this_build_will_embody_it": "Usage = activity (count / last active / session list), unsorted, never a ranking." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-456", "read_at": "2026-08-27T06:24:24+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-08-27T06:24:26+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-771", "read_at": "2026-08-27T06:24:28+08:00",
    "why_it_governs": "A fix proven only in prose returns — the 'no audio filter on the usage view' rule must be encoded where a regression is caught, not just described.",
    "how_this_build_will_embody_it": "The route comment + closure encode 'the usage view must NOT filter on audio'; verified live against real data (integration-shaped, no unit seam)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-08-27T06:24:30+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code; plus a real-data verification (Knute 0 → 44)." }
]
```
