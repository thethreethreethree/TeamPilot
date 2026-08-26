---
started_at: 2026-08-27T05:15:00+08:00
---

# THINK — Team practice rollup + practice-analytics review fixes

## The ask
Founder: "begin working on the optional / remaining builds." First pending item = the TEAM practice overview (the
founder's original "team-level data for the manager's meeting"). Bundled with it: the two findings from the
practice-analytics correctness review — one real honesty bug (verified) + one defense-in-depth note.

## Team practice rollup (§A18-safest, reuse — no new query)
The coach-assessment route already computes each rep's `ManagerPracticeSummary` ({attempts, latest, trend}). The team
rollup is a PURE AGGREGATE over those: active reps, total practices, average latest score, and how many are
improving/slipping. NO individual is named or rankable in the aggregate — the safest §A18 posture (safer than the
per-rep line the founder already approved). §3.4: honest zeros/null when nobody has practiced. `summarizeTeamPractice`
takes the per-rep summaries already in hand — no extra DB query. Surfaced as a "Team practice" stat card on the
manager's Training tab, above the per-rep list.

## Review fix 1 — Finding 1 (§3.4 honesty, VERIFIED against the code before fixing)
`aggregateRepPractice` keyed `byFocus` on ALL attempts but drew per-focus `latest`/`first` from the APPLIED subset with
`?? 0` — so a skill the rep drilled but never once executed showed a fabricated "0" score (the overall latest/trend
already used `?? null` correctly; only the per-focus path lied). Fix: `FocusTrend.latest/first` → `number | null`,
fall back to null, and the row renders "not applied yet" instead of a fake 0. Low blast radius (rep's own view), real
honesty defect. A test locks it (A30).

## Review fix 2 — defense-in-depth (the reviewer's latent note)
The manager practice read filtered by `actor` only. Safe today (actor is a globally-unique user id, the write always
tags actor=rep-self), but for symmetry with the write's tenant tag and correctness if multi-company reps ever ship, the
read now also pins `company_id = ctx.companyId` (INV15-style tenant scoping). Not a live leak — hardening.

## What the review CONFIRMED clean (left unchanged): §A18 manager path (no per-focus leak), the after() write's
company/actor tagging, the ISO-timestamp sort, the honest-empty states, and the type-only client import.

## Ripple (§6 item 5)
No schema, no new route, no migration. The rollup reuses per-rep summaries already computed (no extra query). Finding-1
fix is type + render only. The default roleplay path and the manager per-rep line are unchanged.

## Session-read manifest (A22 — read_at ≥ started_at 05:15:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T05:20:02+08:00",
    "why_it_governs": "Understand the review findings from the code before fixing, and the founder's team-data intent.",
    "how_this_build_will_embody_it": "Verified Finding 1 against the source before fixing; built the team AGGREGATE the founder's original feedback asked for." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T05:20:04+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Cited axioms re-read this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-87", "read_at": "2026-08-27T05:20:06+08:00",
    "why_it_governs": "Layers 2 + 4 — the rollup must be a real, useful team read AND clear.",
    "how_this_build_will_embody_it": "A concise stat card (practices / reps / avg / improving) with an honest empty state." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-163", "read_at": "2026-08-27T05:20:08+08:00",
    "why_it_governs": "THINK the constraint — a team stat must not become a per-rep leaderboard.",
    "how_this_build_will_embody_it": "Pure aggregate, no individual named; the safest §A18 posture. Also acted on the reviewer's tenant note proactively." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-08-27T05:20:12+08:00",
    "why_it_governs": "Events are immutable; state is derived by replay.",
    "how_this_build_will_embody_it": "The rollup derives from the same append-only practice events, no mutable counter." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T05:20:14+08:00",
    "why_it_governs": "Honesty — no fabricated number.",
    "how_this_build_will_embody_it": "Finding-1 fix: per-focus null (not a fake 0); rollup avg null when no applied scores; honest zeros when no practice." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T05:20:16+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: verified the finding, reused summaries, honest states, gated the fix." },
  { "id": "§A18", "source_file": "ThinkerThinker.md", "line_range": "431-432", "read_at": "2026-08-27T05:20:18+08:00",
    "why_it_governs": "Surfacing behaviour data to a leader — label is the defense.",
    "how_this_build_will_embody_it": "Team rollup is a pure aggregate, no individual rankable; a test asserts nobody is named." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-456", "read_at": "2026-08-27T05:20:20+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-08-27T05:20:22+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-771", "read_at": "2026-08-27T05:20:24+08:00",
    "why_it_governs": "Gate the lesson — a fix rots in prose.",
    "how_this_build_will_embody_it": "A test locks Finding-1 (per-focus null, not 0) + the team-rollup honesty/§A18 seams (+4 tests)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-08-27T05:20:26+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
