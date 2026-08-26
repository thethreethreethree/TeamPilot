---
started_at: 2026-08-27T05:17:00+08:00
---

# THINK — Brief scheduling: day/week view + overnight pre-generation (pending item 4)

## The ask
Founder pending list (final item): "the team brief ready automatically each morning, with a day-or-week view." Two
parts: (a) a day/week look-back toggle on the brief, (b) overnight pre-generation so the manager opens to a ready brief
instead of clicking Build.

## The build (parameterize + cache via events + a cron)
- **Day/week:** `generateTeamTrainingBrief(companyId, periodDays = 7)` now takes the window; `labelForDays` gives the
  human label (1 → "the last day"). The route's day/week maps to 1/7. The panel has a Day/Week toggle.
- **Pre-generation (cache):** a generated brief is stored as an append-only `coach.team_brief_generated` event (§3.1 —
  reuse the events store, no new table). `getLatestTeamBrief` reads the newest; the panel GETs it on mount so it opens
  ready. `runTeamBriefPregeneration` (SEQUENTIAL, capped) generates + caches the WEEK brief for each company with
  coaching activity in the window.
- **Cron:** `team-brief-cron` (GET, CRON_SECRET-gated via constantTimeEqual, maxDuration 300), registered in
  vercel.json at 06:00 daily. The manual Build/Rebuild POST also caches, so a reload shows the fresh brief.

## §1.5.3 external-config precondition
The cron depends on CRON_SECRET (external config). It fails LOUD (503) when unset, and Vercel only schedules it because
it's registered in vercel.json. CRON_SECRET is already set for the sibling coach crons (backfill/purge), so this cron
activates on the same secret — no new external setup. Documented here as the precondition.

## §3.1 events / §3.4 honesty
The cache is an append-only event; the panel derives "the latest" by reading, never mutating. The pre-generation only
caches an `ok` brief (never an insufficient/empty shell); the panel still shows the honest insufficient state when there
is no signal. getLatestTeamBrief null-guards a malformed payload.

## Ripple (§6 item 5)
No schema/table (reuse events). New cron route + a vercel.json entry + engine functions + a GET on the brief route + a
panel toggle. The brief generation/honesty seams are unchanged; the shared panel keeps both surfaces in sync.

## Session-read manifest (A22 — read_at ≥ started_at 05:17:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T05:20:02+08:00",
    "why_it_governs": "Understand the existing brief engine + the events store before adding a window + a cache.",
    "how_this_build_will_embody_it": "Parameterized the existing engine; cached via the append-only events store, no new table." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T05:20:04+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Cited axioms re-read this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-87", "read_at": "2026-08-27T05:20:06+08:00",
    "why_it_governs": "Layers 2 + 4 — a real ready-each-morning brief + a clear day/week toggle.",
    "how_this_build_will_embody_it": "Panel opens to the cached brief with a 'generated at' note + a Day/Week toggle." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-163", "read_at": "2026-08-27T05:20:08+08:00",
    "why_it_governs": "THINK the constraint — a cron must be gated + registered or it's a silent dead cron.",
    "how_this_build_will_embody_it": "CRON_SECRET-gated + registered in vercel.json + maxDuration exported." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-176", "read_at": "2026-08-27T05:20:10+08:00",
    "why_it_governs": "The cron depends on CRON_SECRET (external config).",
    "how_this_build_will_embody_it": "Fails LOUD (503) when unset; runs on the same secret the sibling coach crons already use; documented as the precondition." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-08-27T05:20:12+08:00",
    "why_it_governs": "Events are immutable; state is derived by replay.",
    "how_this_build_will_embody_it": "The cached brief is an append-only event; getLatestTeamBrief reads the newest, never mutates." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T05:20:14+08:00",
    "why_it_governs": "Honesty — no fabricated or stale-as-fresh brief.",
    "how_this_build_will_embody_it": "Only an ok brief is cached; the panel shows the generated-at time + the honest insufficient state; null-guards a bad payload." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T05:20:16+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: reused the engine + events, gated + registered the cron, honest states, gated the label." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-456", "read_at": "2026-08-27T05:20:20+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-08-27T05:20:22+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-771", "read_at": "2026-08-27T05:20:24+08:00",
    "why_it_governs": "The day/week label rule rots in prose unless a test fails when '1 day' regresses to 'the last 1 days'.",
    "how_this_build_will_embody_it": "labelForDays is unit-locked (day vs N-days), +2 tests." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-08-27T05:20:26+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
