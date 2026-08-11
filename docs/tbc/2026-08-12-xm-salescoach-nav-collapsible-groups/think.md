---
tbc_version: 1
trigger: feature
started_at: 2026-08-12T01:10:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — Sales Coach sidebar: collapsible "Manager Dashboard" + "Team Tools" groups (founder mockup)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) + docs/THINK-BUILD-CHECK-PROMPTS.md (2a2e34…) present
in-tree, hashes verified. Relevant methodology for a UI-nav change: AMD-006 four-layer framework (structure →
effectivity → composition → surface), specifically Layer 3 (workflow continuity — a nav must never hide the
user's own location) and Layer 4 (surface).

## 2. Why (the founder request — an annotated mockup)
Founder mockup (2026-08-12): restructure the flat Sales Coach sidebar into two COLLAPSIBLE groups —
"Manager Dashboard" (Coach Assessment, Analytics, Sessions) and "Team Tools" (Roleplay, One Liners, Team) —
keeping Home top-level above them and Team Chat / KPI Analytics / Browser extension / Settings top-level below.
The mockup annotates both groups "Colapsable".

## 3. Record check (§1.2) — this grouping was tried AND reverted before
The nav comment at SalesCoachShell.tsx documented that a "Manager Dashboard"/"Team Tools" grouping shipped
2026-07-31 and was REVERTED to a flat list on 2026-08-01 at the founder's request (see
`docs/tbc/2026-08-01-salescoach-flat-nav-and-diagnosis`). So this is NOT a fresh idea — it re-introduces a
reverted structure. The material difference the founder asked for THIS time, and the reason it is not a
re-litigation of the 08-01 decision: the groups are now **collapsible** (the 07-31 version was static headers).
The founder explicitly drew the collapse affordance; that is a new requirement, not the reverted one. Honoring
an explicit, current founder instruction that supersedes a prior preference is correct (§2 surface-don't-
overtake is about not silently rewriting — here the founder is directing the rewrite). The reversal history is
surfaced to the founder in the closure so the decision is made with full context.

## 4. The approach — mirror the proven affordance, don't invent one (A28)
CareShell already ships this exact affordance: the "C.A.R.E Tools" expander — a header toggle button with a
Chevron, items shown under a left rule only when open, and an auto-expand-when-active guard so a collapsed
group never hides the agent's current page. Mirror that implementation (per "make it like Y = mirror Y's impl,
not just the words"): reuse the section model + `filterManagerNavSections`, add a `collapsible` flag, and render
collapsible sections as toggles. No new mechanism.

## 5. Layer-3 continuity design (AMD-006)
- **A collapsed group must not hide where you are.** Both groups default OPEN (the mockup shows them expanded),
  and the active group AUTO-re-opens on navigation into it (persistent-layout `useEffect`, mirroring CareShell).
  So collapsing is a user convenience, never a way to lose your own location.
- **A rep must still reach their own surfaces.** Item-level `managerOnly` gating is unchanged: Coach Assessment
  + Team stay hidden from reps, but Analytics + Sessions (rep-accessible) remain visible under "Manager
  Dashboard". `filterManagerNavSections` drops a group only if ALL its items are hidden — neither group empties
  for a rep, so no bare header shows.

## 6. Hypotheses (§1.5.2)
- **H1 — does the collapsible header break the manager-only filtering?** `filterManagerNavSections` spreads
  `...s`, so `header`/`collapsible` survive the filter; the per-item filter is unchanged. A rep sees "Manager
  Dashboard" → Analytics, Sessions (Coach Assessment hidden) and "Team Tools" → Roleplay, One Liners (Team
  hidden). CONFIRMED by reading the helper — the predicate is item-level, group-preserving.
- **H2 — does the Browser-extension nav parity test still pass?** It asserts the `label`/`href`/`external`
  substrings + the render's `target=_blank`/`rel` — all preserved (the item moved into the bottom ungrouped
  section verbatim, and the external render branch is unchanged). CONFIRMED.

## 7. Open surface note for the founder (Layer 4, not a blocker)
A rep (non-manager) now sees a group literally titled "Manager Dashboard" that, for them, contains only
Analytics + Sessions. That is faithful to the mockup's labels, but if the founder prefers reps not to see the
"Manager Dashboard" wording, the whole group could be made manager-only (reps would then lose the grouped
Analytics/Sessions and get them ungrouped). Left as the founder's Layer-4 call — surfaced, not decided here.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T01:10:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand WHY before building — read the reverted-grouping record before re-introducing it.", "how_this_build_will_embody_it": "Section 3 record-checks the 08-01 revert and identifies the collapsible affordance as the new, non-relitigated requirement." },
  { "id": "§0.1", "read_at": "2026-08-12T01:10:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "CLAUDE.md + ThinkerThinker.md + THINK-BUILD-CHECK hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T01:11:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification (§1.2, the backward-looking-at-the-record rule) — the record shows this exact grouping was reverted once.", "how_this_build_will_embody_it": "Read the 08-01 flat-nav TBC + the in-file comment; distinguished the new collapsible requirement from the reverted static one." },
  { "id": "§1.5.1", "read_at": "2026-08-12T01:11:20Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer framework — Layer 3 (workflow continuity) governs whether a collapsible nav can strand the user.", "how_this_build_will_embody_it": "Default-open + auto-expand-active ensures a collapse never hides the user's location; item-gating keeps a rep's own surfaces reachable." },
  { "id": "§1.5.2", "read_at": "2026-08-12T01:11:35Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — THINK about the failure modes (filter break, test break, rep visibility) before building.", "how_this_build_will_embody_it": "Two hypotheses formed + confirmed by reading the filter helper and the parity test." },
  { "id": "§2", "read_at": "2026-08-12T01:11:50Z", "source_file": "CLAUDE.md", "line_range": "195-210", "why_it_governs": "Surface-don't-overtake — a reverted feature re-requested needs the history surfaced, not silently re-shipped.", "how_this_build_will_embody_it": "The closure surfaces the reversal history so the founder decides with full context." },
  { "id": "§6", "read_at": "2026-08-12T01:12:05Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Decision checklist forces record-check + workflow-trace before acting.", "how_this_build_will_embody_it": "Checklist items 1/2/5a run in sections 3 + 5." },
  { "id": "A19", "read_at": "2026-08-12T01:10:45Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Read CareShell's expander + SalesCoachShell + managerNav in-tree before changing them." },
  { "id": "A22", "read_at": "2026-08-12T01:12:20Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A28", "read_at": "2026-08-12T01:12:35Z", "source_file": "ThinkerThinker.md", "line_range": "740-752", "why_it_governs": "Align to the existing affordance, don't invent a new one.", "how_this_build_will_embody_it": "The collapsible group mirrors CareShell's C.A.R.E Tools expander (toggle button + chevron + left-rule nested items + auto-expand-active)." },
  { "id": "A30", "read_at": "2026-08-12T01:12:40Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson in a test where feasible — this grouping has flip-flopped (shipped 07-31, reverted 08-01, re-requested 08-12), so it needs a regression lock.", "how_this_build_will_embody_it": "Added 6 substring/structure tests in salesCoachShellNav.test.ts locking both collapsible groups, their item order, the manager-only gating, and the toggle affordance so the structure can't silently regress to flat again." },
  { "id": "A38", "read_at": "2026-08-12T01:12:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the npm run check run with its exit code." }
]
```
