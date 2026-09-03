---
started_at: 2026-09-03T13:07:00+08:00
---

# THINK — Rep Arena (gamification personal dashboard from the arena-v2 reference)

## Why (founder-specified design — layer-2, not polish)
The founder asked for "a user interface with this design" — the arena-v2 reference at
LUDUZO-WEBAPP-V2/luduzo-arena/design/arena-v2.html — "but the colorscheme matching ELOSTATE branding … change the
specific elements to match Sales Coach gamification system." Per AMD-012, a user-SPECIFIED experience is the
intended result (layer-2), not deferrable polish. So the deliverable is: mirror the reference's structure faithfully,
reskin to ELOSTATE, rewire every element to a real Sales Coach gamification concept, and VISUALLY VERIFY it.

## Understanding (mirror the reference impl, don't paraphrase it)
I OPENED arena-v2.html and read its structure ("make it like Y" = mirror Y's implementation). It's a mobile-first
(max-width ~400px) personal record-keeping screen: a 270°-arc radial gauge (count-up), an odometer with thousands
separators, a 2-up stat grid, a records board, hexagon award badges (on/off), and a 7-day bar chart. Dark ink ground,
GOLD accent, tabular-nums, uppercase micro-labels, rounded 22px panels, glow shadows, rise/count animations, with a
light-theme variant.

ELOSTATE branding is amber-yellow "the bulb" (#FACC15 / #EAB308 / #FDE047) on matte-black ink (#09090B/#18181B/
#27272A) — remarkably close to the reference gold, so the reskin is exact-ember + ink tokens.

Element mapping (gym → Sales Coach gamification), all fed by EXISTING endpoints (reuse, no new backend):
  gauge    → average points (0–100) + current BAND label, sub = best + rank
  odometer → total points earned
  stats    → strong sessions (>=80) X/Y  +  deals closed
  records  → best pitches (top-3 by points), each linking to its after-pitch (the private detail)
  badges   → milestones (first pitch / strong / first deal / century / closer), on-off by the rep's own stats
  bars     → last 7 sessions' points

## The build
- `bands.ts` (NEW) — client-safe single source for the points scale + bands (rubric.ts is server-only; the UI can't
  import it). rubric.ts + points.ts now RE-EXPORT from it, so nothing re-derives a band boundary (§2.2).
- `arenaSummary.ts` (NEW) — pure `deriveArena`: gauge band, strong count, top-3 records (+NEW-within-7-days + band
  floor), last-7 bars, milestone on/off, best/deals fallback when the leaderboard row is absent. Gate-able (A30).
- `RepArena.tsx` (NEW) — the client component: fetches the caller's own /my-points + /leaderboard (best/deals/rank),
  renders the six elements with scoped ELOSTATE CSS (accent via --brand-text so it holds in BOTH themes; decorative
  glows/gradients soften under the light override). Count-up + arc + rise animations respect reduced-motion.
- Page `/dashboard/sales-coach/my-progress` + a rep-facing "My Progress" nav item (Gauge icon, NOT managerOnly).

## Verification (AMD-012 / A38 / §5 — verify the SPECIFIED design by looking)
6 deriveArena tests + typecheck + lint + theme:audit (0 leaks) + full suite. RENDERED the arena to PNG in BOTH
themes and read them: dark = glowing ember gauge (76 / Solid / best 92 · rank #1), odometer 4,210, 9/57 strong + 9
deals, best-pitches board, 3 lit + 2 locked milestones, amber bars. light = darkened ember (#A16207) accents hold on
cream, glows removed, badges lightened — legible in both. Privacy (A18): the screen is the rep's OWN; per-session
detail links to their own after-pitch and never leaves owner-scope.

## Out of scope
Replacing the compact MyProgress strip on the Scoreboard (left as-is — the Arena is the full personal view; removing
the strip is a separate call, not this build). A milestones STORE (milestones are derived from stats, no new table).

## Session-read manifest (A22 — read_at >= started_at 13:07; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T13:09:00+08:00",
    "why_it_governs": "Understanding precedes solving — I OPENED the reference design and read its structure before mirroring it, rather than paraphrasing 'an arena screen' from the word.",
    "how_this_build_will_embody_it": "The component mirrors arena-v2's six elements faithfully, each rewired to a real gamification concept." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T13:09:10+08:00",
    "why_it_governs": "The methodology defining understanding must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md in context; the cited axioms re-opened this session (timestamps below)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T13:09:12+08:00",
    "why_it_governs": "Retrospective identification — I reused the existing gamification endpoints + the fetch/theme/nav conventions from the record, not new machinery.",
    "how_this_build_will_embody_it": "Arena reads /my-points + /leaderboard; mirrors MyProgress's fetch + after-pitch link + the shell nav pattern." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "74-92", "read_at": "2026-09-03T13:09:14+08:00",
    "why_it_governs": "Holistic — extracting bands.ts touches rubric.ts + points.ts; I traced the ripple before splitting the module.",
    "how_this_build_will_embody_it": "rubric.ts/points.ts re-export from bands.ts; all importers unchanged; 27 gamification tests still pass." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T13:09:20+08:00",
    "why_it_governs": "Layer-2 effectivity — a design must actually render correctly with real data, proven.",
    "how_this_build_will_embody_it": "Rendered both themes to PNG + read them; the derivation is unit-tested; wired to live endpoints." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-03T13:09:30+08:00",
    "why_it_governs": "Reuse the repo's tokens/shell/endpoints, don't template a new system.",
    "how_this_build_will_embody_it": "Uses ELOSTATE CSS tokens + --brand-text, the SalesCoachShell nav, and the existing gamification routes." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-198", "read_at": "2026-09-03T13:09:34+08:00",
    "why_it_governs": "External-config completeness — carried from the parent gamification build (0244 still pending db:apply).",
    "how_this_build_will_embody_it": "The Arena needs no new migration; it reads endpoints that are already live (0242/0243)." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-235", "read_at": "2026-09-03T13:09:36+08:00",
    "why_it_governs": "A user-SPECIFIED experience is layer-2 — the founder named the design as the deliverable, so it is the RESULT, not polish.",
    "how_this_build_will_embody_it": "Mirrored the specified reference faithfully + reskinned to ELOSTATE + VISUALLY VERIFIED both themes before calling it done." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-270", "read_at": "2026-09-03T13:09:38+08:00",
    "why_it_governs": "Ground-up audit — the reskin rests on reading the reference from its tokens up.",
    "how_this_build_will_embody_it": "Palette + structure derived from the reference's own CSS variables, remapped to ELOSTATE tokens." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T13:09:42+08:00",
    "why_it_governs": "Single-source — the client UI must NOT re-derive the band boundaries the server already defines.",
    "how_this_build_will_embody_it": "bands.ts is the one source; rubric.ts + points.ts + the Arena all consume it — no duplicated boundary to drift." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-09-03T13:09:44+08:00",
    "why_it_governs": "Honesty — no fabricated numbers or milestones.",
    "how_this_build_will_embody_it": "Every value is real (from the rep's own ledger + board); an empty history shows an honest empty state, not zeros; milestones reflect true stats." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-392", "read_at": "2026-09-03T13:09:46+08:00",
    "why_it_governs": "Measurement — the surfaced points must be defensible (the same authoritative totals, not a re-derived variant).",
    "how_this_build_will_embody_it": "Reads the same my-points (now full-history) + leaderboard SUM the rest of the system uses." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-430", "read_at": "2026-09-03T13:09:48+08:00",
    "why_it_governs": "Verify (incl. visually) before claiming done; distrust the fast-confident answer.",
    "how_this_build_will_embody_it": "Rendered + read BOTH themes; ran tests + lint + theme + typecheck before reporting." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T13:09:50+08:00",
    "why_it_governs": "Quick-decision checklist (specified experience = layer-2, reuse, single-source, verify visually).",
    "how_this_build_will_embody_it": "All four honored — see the entries above." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-450", "read_at": "2026-09-03T13:08:00+08:00",
    "why_it_governs": "Privacy — this is the REP's own screen; per-session detail must not become a manager's window on a named rep.",
    "how_this_build_will_embody_it": "The Arena reads owner-scoped /my-points; records link to the rep's OWN after-pitch; no manager view of someone else." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-03T13:08:10+08:00",
    "why_it_governs": "Methodology in the tree, read in session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session before citing them." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-640", "read_at": "2026-09-03T13:08:20+08:00",
    "why_it_governs": "Session-read manifest before closure.",
    "how_this_build_will_embody_it": "This manifest pairs each cited asset with an in-session read_at; the commit carries the Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-03T13:08:30+08:00",
    "why_it_governs": "Gate the lesson — the derivation must be pinned by a test, not left inline + untested.",
    "how_this_build_will_embody_it": "Extracted deriveArena as a pure function with 6 tests (band/records/bars/milestones/fallback)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-03T13:08:40+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md names typecheck/lint/theme/tests and the two rendered PNGs read for both themes." }
]
```
