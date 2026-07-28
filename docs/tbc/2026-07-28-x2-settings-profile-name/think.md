---
tbc_version: 1
trigger: feature
started_at: 2026-07-28T16:20:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 3
---

# THINK — Settings: edit your own name (fills the account gap)

First bounded slice of "substantial Settings" (founder request). The Settings/account map found
the clearest gap: `profiles.full_name` is set ONCE at onboarding with **no edit surface anywhere**.
This adds a "Your profile" panel to `/dashboard/settings` to edit the name + view the email. It does
NOT restructure Settings — the larger unified-hub scope awaits founder confirmation.

## 1. Document integrity (§0.1)

Hashes MATCH `docs/tbc/DOC_MANIFEST.json`. Proceed.

## 2. Session-read manifest (A22)

```json
[
  { "id": "§0",     "read_at": "2026-07-28T16:25:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understand before solving — the risk is a name-edit that RLS silently rejects; the DB write path had to be understood (0090 guard) before building.", "how_this_build_will_embody_it": "The privileged-column guard was read and confirmed to exempt full_name before writing the update." },
  { "id": "§0.1",   "read_at": "2026-07-28T16:25:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology read this session; the manifest records the reads.", "how_this_build_will_embody_it": "read_at is this session; ranges gate-checked." },
  { "id": "§1.5.1", "read_at": "2026-07-28T16:25:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — a settings control is user-facing; layer 2 (does saving actually persist) is the whole point, given the write could be blocked by a trigger.", "how_this_build_will_embody_it": "Section 5 walks the layers; the write path is proven against the 0090 guard." },
  { "id": "§1.5.2", "read_at": "2026-07-28T16:25:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — hypothesised the write path could be guard-blocked, then confirmed by reading 0090.", "how_this_build_will_embody_it": "H1 was tested against the migration before the component was wired." },
  { "id": "§6",     "read_at": "2026-07-28T16:25:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "The checklist — scope: this is ONE bounded gap-fill, not the whole Settings redesign; overtaking the founder's structural decisions is avoided.", "how_this_build_will_embody_it": "Only the name-edit gap is filled; the unified-hub scope is left for the founder." },
  { "id": "A19",    "read_at": "2026-07-28T16:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree — read live.", "how_this_build_will_embody_it": "This-session reads recorded." },
  { "id": "A22",    "read_at": "2026-07-28T16:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "Every cited id resolves to a this-session entry." },
  { "id": "A28",    "read_at": "2026-07-28T16:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "A precedent decides the write mechanism: AvatarCustomizationPanel already writes profiles via the own-row RLS policy — no new API. Follow it, don't invent a route.", "how_this_build_will_embody_it": "ProfilePanel uses the same createClient + profiles.update pattern." },
  { "id": "A30",    "read_at": "2026-07-28T16:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "The guarantee that full_name is user-editable is encoded in the 0090 trigger (a gate), not just assumed — the build rests on that gate.", "how_this_build_will_embody_it": "The write relies on the trigger's explicit full_name exemption, not on hope." },
  { "id": "A31",    "read_at": "2026-07-28T16:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-820", "why_it_governs": "Schema-complete is not built — a name field that RLS rejects on save is a dead control. The write path must actually persist AND be read back.", "how_this_build_will_embody_it": "build.md asserts the write (profiles.update full_name, guard-permitted) and read (full_name shown across the app) paths." },
  { "id": "A38",    "read_at": "2026-07-28T16:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a command — closes after npm run check with its exit code.", "how_this_build_will_embody_it": "closure.md pastes the canonical command output." }
]
```

## 3. Hypotheses

```json
[
  { "id": "H1", "claim": "A direct authenticated update of profiles.full_name succeeds — the privileged-column guard (0090) does not block it.", "confidence": "high", "test": "Read 0090's trigger body.", "outcome": "CONFIRMED — the trigger raises only on role/company_id/sales_coach_role/is_support_agent changes and its comment explicitly names full_name as a still-editable non-privileged field." },
  { "id": "H2", "claim": "There is a precedent for writing profiles from a settings panel without a new API route.", "confidence": "high", "test": "Read AvatarCustomizationPanel.", "outcome": "CONFIRMED — it updates profiles.avatar_* directly via the own-row RLS policy. ProfilePanel mirrors it." },
  { "id": "H3", "claim": "full_name has a real read path, so editing it is visible, not dead config.", "confidence": "high", "test": "It drives avatar initials + message attribution across the app.", "outcome": "CONFIRMED — full_name is read in AvatarCustomizationPanel and derives avatarInitialsFor across surfaces." }
]
```

## 4. Spec fidelity

- **Restated:** let a user edit their own name after onboarding (and see their sign-in email), as the first slice of substantial Settings.
- **As written, bounded.** Email is read-only (no email-change flow exists; not inventing one). The full Settings redesign is NOT done here — that scope awaits founder confirmation, surfaced separately.
- **Precedent (A28):** the avatar panel's RLS-direct-write decides the mechanism. No founder decision to flag.

## 5. Four-layer pre-walk (§1.5.1)

- **1 structure:** one client panel mirroring the established settings-panel pattern; direct RLS write, no new route.
- **2 effectivity:** typing a name + Save persists full_name (guard-permitted); the field reloads with the saved value. Save is disabled unless the name changed and non-empty.
- **3 composition:** the user opens Settings → Your profile is the first panel → edits name → saves → it flows to their avatar/attribution. No dead end.
- **4 surface:** on-brand glass-card panel, consistent with the neighbouring Avatar/Password panels.

**verdict: SHIPPABLE.**
