---
tbc_version: 1
trigger: feat
started_at: 2026-07-30T13:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 2
---

# THINK — Comprehensive module settings, pillar 2: C.A.R.E "General" tab

Founder-approved full spec. Pillar 2 gives C.A.R.E a "General" tab: the cross-cutting per-user dials
(Learning Mode + Experience Mode) that the main Elostate settings expose — now inside the C.A.R.E setting
system (the founder's standing pattern: apply the learning/experience system to each module's settings,
same structure as Elostate) — plus a jump-map to every C.A.R.E config surface so nothing stays buried.

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json this session.

## 2. Why + zero-risk design (§1.5, A30)

Learning Mode + Experience Mode are PER-USER, self-contained panels (own endpoints). Putting them on a new
General page touches NO tenant config, so — unlike pillar 1 — there is no shared-Save clobber risk at all
(A30: the safety is structural, by construction, not by discipline). The only cleanup: Experience Mode was
on the settings LANDING; it moves to the General tab and the landing's duplicate copy is removed.

## 3. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-30T13:01:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding precedes solving — I verified (grep) that Sales Coach ALREADY has Learning+Experience on its Account tab before adding a redundant tab there, and that C.A.R.E only had Experience (on the landing), not Learning.", "how_this_build_will_embody_it": "Sales-Coach General SKIPPED (already covered); C.A.R.E General adds the genuinely-missing Learning dial + consolidates Experience." },
  { "id": "§0.1",   "read_at": "2026-07-30T13:01:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session, not cited from cached labels.", "how_this_build_will_embody_it": "Integrity MATCH with this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-30T13:01:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — layer 3/4 (discoverability): a General tab with a jump-map means no config surface is buried; the user lands and sees the whole map.", "how_this_build_will_embody_it": "General is the first tab + first landing card; it links to AI/Widget/Account." },
  { "id": "§1.5.2", "read_at": "2026-07-30T13:01:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Think then search — I searched the sales-coach settings before building, which is how I caught that its Account tab already renders both panels (avoiding a redundant build).", "how_this_build_will_embody_it": "grep-confirmed coverage → Sales-Coach General dropped from scope." },
  { "id": "§6",     "read_at": "2026-07-30T13:01:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — trace what a new tab affects: the tab bar (add General), the landing (add a card, remove the now-moved Experience panel), and confirm the reused panels are self-contained (no new Save).", "how_this_build_will_embody_it": "SettingsTabs + landing card added; landing Experience block removed; panels unchanged." },
  { "id": "A19",    "read_at": "2026-07-30T13:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology assets read from the working tree this session — the CAT-001 defense.", "how_this_build_will_embody_it": "This-session reads across all 13 entries." },
  { "id": "A22",    "read_at": "2026-07-30T13:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "500-520", "why_it_governs": "Every cited asset paired with an in-session re-read timestamp before closure.", "how_this_build_will_embody_it": "The manifest pairs each clause with a this-session read_at." },
  { "id": "A24",    "read_at": "2026-07-30T13:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "540-560", "why_it_governs": "Don't manufacture work — I did NOT build a redundant Sales-Coach General tab once I found the panels already there; honest non-build is valid.", "how_this_build_will_embody_it": "Scope trimmed to the genuinely-missing C.A.R.E case." },
  { "id": "A28",    "read_at": "2026-07-30T13:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "620-645", "why_it_governs": "Precedent decides — the main Elostate settings + the Sales-Coach Account tab establish 'Learning + Experience live in the module setting system'; C.A.R.E should match.", "how_this_build_will_embody_it": "The General tab renders the same two panels the precedents use." },
  { "id": "A30",    "read_at": "2026-07-30T13:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "660-685", "why_it_governs": "Encode safety structurally — the panels are per-user + self-contained, so there is NO shared-Save to clobber; safety is by construction, not discipline.", "how_this_build_will_embody_it": "General touches no tenant config; zero clobber surface." },
  { "id": "A31",    "read_at": "2026-07-30T13:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "700-725", "why_it_governs": "Schema-complete ≠ built — a General tab must be reachable + its panels must actually work, not be a placeholder.", "how_this_build_will_embody_it": "Tab + landing card link it; the reused panels are the same working ones from the main settings." },
  { "id": "A34",    "read_at": "2026-07-30T13:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "760-785", "why_it_governs": "Migration-coupled code must degrade — but this build adds NO migration and no new column.", "how_this_build_will_embody_it": "Pure UI composition of existing self-contained panels." },
  { "id": "A38",    "read_at": "2026-07-30T13:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "820-845", "why_it_governs": "Verified = a named command — the 'don't break it' constraint requires a real compile check after the landing edit (removed import) + the new page.", "how_this_build_will_embody_it": "npx tsc --noEmit → exit 0 (closure.md)." }
]
```

## 4. Hypotheses

1. Reusing the self-contained per-user panels means zero tenant-config risk. (Confirmed: tsc 0; no Save.)
2. A first-position General tab + card with a jump-map fixes the "where is everything?" layer-3/4 gap.
