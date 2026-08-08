---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T04:40:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 9
hypotheses: 1
---

# THINK — Sales Coach: "Browser extension" sidebar nav entry (mirror C.A.R.E)

(Build `xk` — post-9 daily builds sort after `x9` as xa..xk.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) unchanged this session (hashes match DOC_MANIFEST, recomputed
earlier + files untouched since). The TT axioms cited below (A19/A22/A30/A38) were RE-READ FRESH this build
(04:47–04:50Z) — not carried from the earlier builds — because this build began hours later (founder request),
so honest read timestamps must post-date this build's start (A22).

## 2. The miss, understood from the founder's correction (§0)
Founder instruction (original): make the Sales Coach extension surfacing "similar to the C.A.R.E extension."
The founder pointed at C.A.R.E's screenshot: a persistent left-sidebar nav item "Browser extension" (puzzle
icon). On the first pass I delivered the download CAPABILITY — a `/extension/download-sales` page + inline
"Get the Sales Coach extension" cards on the dashboard page — but did NOT mirror the NAV-ITEM placement. I built
a functional equivalent (a link on the page) instead of the structural mirror (the sidebar entry). The founder
asked "why didn't you follow the initial instruction?" — a fair catch. Root cause: I read "similar" as
"a download link on the page" (which the directive also literally said) and did not open `CareShell.tsx` to see
HOW C.A.R.E surfaces the extension and replicate that exact pattern. Interpreting an instruction by the letter
of one clause while missing the pattern it pointed to.

## 3. The fix (§0 → solution after understanding)
`CareShell.tsx:123`: `{ label: "Browser extension", href: "/extension/download", icon: Puzzle, external: true }`
in its SECONDARY_NAV, rendered as a `<Link>` with `target=_blank rel=noopener` (opens the download page in a new
tab, kept out of active-state). Mirror it in `SalesCoachShell.tsx`'s flat NAV_SECTIONS, before Settings (C.A.R.E
order: …Browser extension, Settings), href `/extension/download-sales`, `external: true`, with the same
new-tab + exclude-from-active handling. NOT added to the mobile tab bar — a browser extension is desktop-only,
irrelevant on the mobile PWA, so a mobile slot would be wrong.

## 4. Interconnection trace (holistic)
- Only `SalesCoachShell.tsx` (the shell) changes; the download page + inline cards + zip are untouched and stay.
- `external` is a NEW field on the shell's NavItem type; the active-state computation and the `<Link>` render
  both branch on it. Non-external items are byte-unchanged in behavior (the spread is `{}` for them).
- The extension page lives OUTSIDE this fixed-overlay shell (the shell is a full-viewport overlay), so external
  (new tab) is the correct nav — a client `<Link>` into a non-shell route could leave the overlay half-torn.

## 5. Hypothesis (§1.5.2) + the gate (A30)
- **H1:** the nav entry renders, points to the sales download page, and opens external. Confirm: a source guard
  asserts SalesCoachShell contains the `Browser extension` item → `/extension/download-sales`, `external: true`,
  and the render honors external (`target: "_blank"`, `rel: "noopener noreferrer"`). **Held** (3 tests pass).
- **A30 — why a test, not just the fix:** this parity was MISSED once (shipped as page cards, not the nav item).
  A prose "remember to mirror C.A.R.E" would let it drop again. The guard fails CI if the nav entry is removed or
  mispointed — the boundary of the class is the gate, not the one fix.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T04:50:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — diagnose WHY the instruction was missed before re-building.", "how_this_build_will_embody_it": "Section 2 diagnoses the letter-vs-pattern miss from the founder's correction before the fix." },
  { "id": "§0.1", "read_at": "2026-08-08T04:50:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, hashes verified.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH + fresh axiom reads for this build." },
  { "id": "§1.5.1", "read_at": "2026-08-08T04:50:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L4 (surface): the extension must be surfaced where the user expects it, matching the product pattern.", "how_this_build_will_embody_it": "The fix places the nav entry in the sidebar (the C.A.R.E surface pattern), not only inline cards." },
  { "id": "§1.5.2", "read_at": "2026-08-08T04:50:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Trace the workflow/surface a real user expects; the founder's own product (C.A.R.E) is the reference.", "how_this_build_will_embody_it": "Mirrors the C.A.R.E nav surface the founder pointed at; mobile correctly excluded." },
  { "id": "§6", "read_at": "2026-08-08T04:50:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist — is this a gate or a promise?", "how_this_build_will_embody_it": "Shipped with a detection test, not a prose promise." },
  { "id": "A19", "read_at": "2026-08-08T04:49:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-470", "why_it_governs": "Methodology in the tree, consulted THIS build (not cached).", "how_this_build_will_embody_it": "Axioms re-read fresh this build (04:47–04:50); timestamps post-date started_at." },
  { "id": "A22", "read_at": "2026-08-08T04:48:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-621", "why_it_governs": "Citations require in-session reading; timestamps must reflect THIS build.", "how_this_build_will_embody_it": "Re-read fresh rather than backdating the earlier-build reads to a later started_at." },
  { "id": "A30", "read_at": "2026-08-08T04:47:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-789", "why_it_governs": "THE governing axiom — a missed lesson recorded only in prose returns; encode it in a gate.", "how_this_build_will_embody_it": "The nav parity I missed is now a CI-failing detection test, not a promise to remember." },
  { "id": "A38", "read_at": "2026-08-08T04:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1020", "why_it_governs": "'Verified' = the canonical command by name, with its output.", "how_this_build_will_embody_it": "check.md pastes `npm run check` + exit code." }
]
```
