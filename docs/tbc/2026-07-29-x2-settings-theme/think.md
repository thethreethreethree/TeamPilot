---
tbc_version: 1
trigger: feat
started_at: 2026-07-29T06:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — Settings substantial, Slice 1: Theme (company default + per-user override + DB persist)

Founder "make Settings substantial" (2026-07-28), decisions locked: theme = admin/company default +
per-user override, resolve user→company→system; admin actions company-scoped. Today theme is
localStorage-only (no DB, no company default). This slice adds the DB layer non-breakingly.

## 1. Document integrity (§0.1)

Live hashes of CLAUDE.md + ThinkerThinker.md MATCH DOC_MANIFEST.json (unchanged this build). Proceed.

## 2. Why (root cause, from the record — §0)

The theme system (`ThemeProvider.tsx`) persists only to `localStorage` (`execos.theme.v1`); there is no
`profiles`/`companies` column and no company default (confirmed by reading the provider + grepping the
migrations). So a user's theme doesn't follow them across devices and an admin can't set a house default.
The founder's ask is exactly those two gaps.

## 3. Session-read manifest (A22)

```json
[
  { "id": "§0",     "read_at": "2026-07-29T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Diagnose before building — the localStorage-only source of truth was read from ThemeProvider.tsx before designing the DB layer, so the fix targets the real gap.", "how_this_build_will_embody_it": "Section 2 states the gap from the code, not a theory." },
  { "id": "§0.1",   "read_at": "2026-07-29T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the working tree, read this session.", "how_this_build_will_embody_it": "This manifest carries this-session read_at values." },
  { "id": "§1.5.1", "read_at": "2026-07-29T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers, foundation-up: schema (col) → effectivity (resolve) → composition (works with the existing toggle + learning-mode flip) → surface (the panel).", "how_this_build_will_embody_it": "Section 5 walks the layers; the migration is the foundation, the panel the surface." },
  { "id": "§1.5.2", "read_at": "2026-07-29T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Think then search — hypothesised the non-breaking design (localStorage stays pre-paint; DB reconciles) then confirmed against ThemeProvider + the guarded-fallback precedent.", "how_this_build_will_embody_it": "Hypotheses carry confirmed outcomes." },
  { "id": "§6",     "read_at": "2026-07-29T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — trace what this change affects; the global ThemeProvider is shared, so the change is additive + guarded, never a rewrite.", "how_this_build_will_embody_it": "localStorage path is untouched; the DB reconcile is a new guarded effect." },
  { "id": "A19",    "read_at": "2026-07-29T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree.", "how_this_build_will_embody_it": "This-session reads recorded." },
  { "id": "A22",    "read_at": "2026-07-29T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "Every cited id resolves to a this-session entry; commit uses Session-Reads Form A." },
  { "id": "A28",    "read_at": "2026-07-29T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "A precedent decides the shape: /api/me/learning-mode + experience-mode (0110) already define the per-user-pref route + column pattern. The theme route COPIES it rather than inventing a new one.", "how_this_build_will_embody_it": "/api/me/theme mirrors /api/me/learning-mode; profiles.theme_preference mirrors learning_mode_enabled / experience_mode." },
  { "id": "A31",    "read_at": "2026-07-29T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-817", "why_it_governs": "Schema-complete is not built — the migration column alone is nothing without a read+write path all the way to the surface.", "how_this_build_will_embody_it": "build.md asserts write-path (panel→route→column) AND read-path (column→route→ThemeProvider→painted) for each feature." },
  { "id": "A34",    "read_at": "2026-07-29T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "870-897", "why_it_governs": "Code that hard-requires a not-yet-applied migration is an outage with a timer — reads degrade, writes fail honestly, and the predicate names the column.", "how_this_build_will_embody_it": "The route uses isMissingColumnError(err, 'theme_preference'/'default_theme'); a pending 0201 degrades to localStorage-only, never a broken page." },
  { "id": "A30",    "read_at": "2026-07-29T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — the resolution rule is encoded as a pure, unit-pinned function, not left implicit in an effect.", "how_this_build_will_embody_it": "reconcileTheme() is exported + tested (6 assertions)." },
  { "id": "A38",    "read_at": "2026-07-29T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a command — closes after npm run check.", "how_this_build_will_embody_it": "closure.md pastes the canonical command output + exit 0." }
]
```

## 4. Hypotheses

```json
[
  { "id": "H1", "claim": "Theme DB-persistence can be added WITHOUT touching the flash-free pre-paint path or the existing localStorage behavior — so it is non-breaking even if migration 0201 is never applied.", "confidence": "high", "test": "Add the DB reconcile as a NEW guarded effect that fires only when localStorage has no value; guard every DB touch with isMissingColumnError. Typecheck + the reconcileTheme test.", "outcome": "CONFIRMED — localStorage path unchanged; reconcile is additive + guarded; tsc exit 0; 6/6 reconcileTheme assertions pass." },
  { "id": "H2", "claim": "Adding theme_preference to profiles does NOT require touching the 0090 privileged-column guard — it is self-editable like learning_mode_enabled.", "confidence": "high", "test": "Read the 0090 guard (blocklist of role/company_id/sales_coach_role/is_support_agent); confirm non-listed columns are self-writable.", "outcome": "CONFIRMED — 0090 is a blocklist; theme_preference is not on it, so self-RLS on profiles allows the user's own write. No guard change." }
]
```

## 5. Four-layer pre-walk (§1.5.1)

- **1 structure:** one migration (profiles.theme_preference nullable + companies.default_theme not-null
  default 'system'); the resolution rule extracted to a pure reconcileTheme().
- **2 effectivity:** a user picking a theme persists cross-device; a new user with no pick inherits the
  company default; an admin sets that default. Proven by tsc + the reconcileTheme test.
- **3 composition:** the existing ThemeToggle + the learning-mode dark-flip still work (they call
  setPreference, which now ALSO persists — a strict superset). No existing surface disturbed.
- **4 surface:** an Appearance panel on Settings with a per-user segmented control + an admin-only
  company-default control.

**verdict: SHIPPABLE** (migration ships with the code; code degrades to localStorage-only until applied).
