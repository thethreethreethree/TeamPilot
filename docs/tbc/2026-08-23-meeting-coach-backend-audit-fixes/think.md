---
started_at: 2026-08-23T08:45:00+08:00
---

# THINK — Meeting Coach backend/wiring audit fixes (founder: "no backend bugs")

The backend half of the founder-directed Meeting Coach audit (the UI half shipped in
`docs/tbc/2026-08-23-meeting-coach-ui-audit-fixes`). Each finding came from the 4-agent audit + my behavioral
probes and was VERIFIED against the code (A26: a finding is a suspect) before fixing.

## HIGH
- **INT-1 — clean-Stop audio loss → permanently unreviewable + false "saved".** A clean Stop whose full-blob
  `persistRecording` failed left `audio_asset_url` NULL with the live 15s chunks still in storage. The ONLY caller
  of `stitchSessionAudio` is the stale-close cron, which selects `status='active'` >6h — but `/end` set `'ended'`,
  so nothing ever assembled the chunks → the dissect 409-looped forever (the "fragile cron-only trigger → silent
  empty" class, made worse because `/end` moves the session out of the cron's filter). Fix: **stitch-on-demand in
  the dissect route** when `audioAssetUrl` is null (idempotent + service-role; no-op if truly no chunks → honest
  409). Self-healing review from whatever streamed.

## MED
- **INT-3 — prep→session link silent no-op.** `markMeetingPrepStarted` did a bare RLS update + `return !error`;
  a 0-rows update (stale/foreign/other-company prepId — RLS WITH CHECK) is NOT an error, so it reported success
  while linking nothing → an agenda-less meeting the panel still called "prep loaded." Fix: `.select("id")` +
  row-count → false on a no-op; the create route logs it + returns `prepLinked`.
- **BE — getMeetingPrep error → false 404 (error-as-no-data).** It collapsed a real DB error to null → the GET
  route returned 404 "prep not found" for a transient failure (told the user their prep was deleted). Fix: THROW
  on a genuine error (route now try/catches → honest 500); null reserved for a real no-row. Same for
  `listPrepDocuments` ([] must mean no docs). The brain-side reads (`getMeetingPrepBySession`, `getPrepDocContext`)
  LOG-and-degrade (the cue path must not break) instead of silently swallowing.
- **INT-2 — coverage silently never accumulates + dissect throws away live coverage.** Topic ids were 36-char
  UUIDs the LLM had to echo verbatim in `covered`; it dropped/altered them → the live loop never flipped `covered`
  (the coach re-nudged discussed topics) and the dissect judged discussed topics "missed." Compounding: the
  dissect recomputed coverage PURELY from its own echo, ignoring the live-accumulated flag. Fix: **short topic ids**
  (`t`+5 base36 — round-trips reliably) + the dissect **OR-in** the live `t.covered`.

## Deferred (flagged in the residual, not this commit)
INT-4 (huddle brain ignores the agenda the cue route loads — needs the huddle brain to consume it or a product
call on huddle+prep); SEC MED-1 (the document route re-implements a weaker allowlist instead of the
`validateUploadCandidate` chokepoint) + MED-2 (image-bomb OCR guard, needs a bounded decoder); the topic-coverage
whole-JSONB lost-update race under concurrent cues; and the multi-company LOWs (a `session.companyId===companyId`
assertion; the doc `company_id`=parent constraint) — all safe today under single-company use.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "Understand before solving — each finding read back against the code before the fix.",
    "how_this_build_will_embody_it": "INT-1/INT-2/INT-3 fixes target the traced root (cron filter / UUID echo / 0-row update), not the symptom." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited CLAUDE §§ + axioms via Read this session before fixing." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "Retrospective — the fixes come from the audit's reading of what the code actually does.",
    "how_this_build_will_embody_it": "Traced the cron/stitch trigger, the RLS 0-row semantics, the id round-trip from the code." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "Layer-2 — the feature must actually WORK: a review must be reachable, a prep must attach, coverage must track.",
    "how_this_build_will_embody_it": "INT-1 makes the review self-heal; INT-3 makes the prep link real; INT-2 makes coverage accumulate." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "Proactive audit across the whole wiring, not one route.",
    "how_this_build_will_embody_it": "Traced prep→create→cue→coverage→dissect→audio end-to-end; fixed the seams that break between files." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-388", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "Honesty — a false 'saved/review ready', a false 'prep loaded', a false 404 are failures shown as success.",
    "how_this_build_will_embody_it": "INT-1 self-heals or 409s honestly; INT-3 reports the real link result; getMeetingPrep 500s (not false 404)." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: verified each finding, traced ripple, separated UI/backend commits, added regression tests." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "A reported bug is one instance of a class; audit findings are suspects verified against the code.",
    "how_this_build_will_embody_it": "Verified each; INT-1 is the fragile-cron-trigger class; the honesty gaps are the error-as-no-data class." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "+5 tests: markMeetingPrepStarted false-on-0-rows/error, true-on-1; getMeetingPrep throws-on-error / null-on-no-row." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T08:51:22+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
