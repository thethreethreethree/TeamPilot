---
tbc_version: 1
trigger: feat
started_at: 2026-07-30T12:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 3
---

# THINK — Comprehensive module settings, pillar 1: C.A.R.E "AI & Personality" tab

Founder directive (2026-07-30): build a COMPREHENSIVE settings system for both modules (C.A.R.E +
Sales Coach), mirroring the substantial main Elostate settings. The founder reported repeatedly that the
recent C.A.R.E/Sales-Coach settings work was invisible to them. Root cause (diagnosed this session, on the
record in BUILD-STATE): NOT deploy/cache/role — the "make Jeff yours" config (name, product, tone, length,
guidance, knowledge) was buried at the BOTTOM of the Widget tab, whose landing card reads "chat widget:
appearance, embed" — nobody looks there for AI config. Pillar 1 lifts it to a dedicated, discoverable
"AI & Personality" tab (mirrors Sales Coach's dedicated Coaching tab — A28 precedent).

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json this session.

## 2. Why + precedent (§0, A28)

Sales Coach already gives its "make it yours" config a dedicated Coaching tab. C.A.R.E buried the
equivalent inside Widget. A28 (precedent decides): mirror the Coaching-tab pattern — a dedicated tab.
The AI-persona fields already exist on the tenant config; this MOVES their UI, it does not add schema.

## 3. Holistic trace (§1.5) — the one real risk

The Widget page saves ALL its fields (appearance, origins, branding, AI persona, voice) through one shared
draft + Save. Moving the AI-persona UI to a new page with its OWN Save means BOTH pages could write the
same 4 columns → a stale-draft clobber (saving Widget would revert AI edits). Defense: the new AI page
PATCHes ONLY {aiName, aiProductContext, aiTone, aiResponseLength}; the Widget Save has those 4 keys
REMOVED. /api/care/agent/tenant is a partial patch, so the two Saves are now disjoint — no field is
written by both pages. Verified by reading the save bodies + typecheck (no dangling refs after the trim).

## 4. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-30T12:01:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding precedes solving — I diagnosed the invisibility to root cause (placement, proven with the deployed-commit + ungated-render evidence) before touching code, instead of building on the first theory.", "how_this_build_will_embody_it": "Section on root cause; the fix targets the diagnosed placement defect, not a guess." },
  { "id": "§0.1",   "read_at": "2026-07-30T12:01:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "The methodology docs must be in the tree + read this session, not cited from cached labels, before a substantive build.", "how_this_build_will_embody_it": "Integrity MATCH recorded with this-session read_at timestamps." },
  { "id": "§1.5.1", "read_at": "2026-07-30T12:01:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — a feature can pass structure/effectivity yet fail layer 3/4 (discoverability): the AI config WORKED but the workflow never led the user to it, so it read as missing.", "how_this_build_will_embody_it": "Pillar 1 fixes the layer-3/4 gap by surfacing a discoverable tab + landing card; the fields still save + reach Jeff's prompt (layers 1-2 preserved)." },
  { "id": "§1.5.2", "read_at": "2026-07-30T12:01:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Think then search — I proactively audited the upload feature end-to-end (found the extract route honors per-field caps, DocUploadButton surfaces truncation) before concluding the build was sound.", "how_this_build_will_embody_it": "The AI page reuses the audited DocUploadButton + per-field cap (8k product context)." },
  { "id": "§6",     "read_at": "2026-07-30T12:01:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — trace what moving a config surface affects: the Widget page's shared Save (must not clobber), the AI fields' read path (Jeff's prompt, unchanged), the settings landing + tab bar (must link the new page).", "how_this_build_will_embody_it": "Widget Save keys removed; tab + landing card added; read path untouched." },
  { "id": "A19",    "read_at": "2026-07-30T12:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "The methodology assets governing this build were read from the working tree this session, not cited from cached labels — the CAT-001 defense.", "how_this_build_will_embody_it": "This-session reads recorded across all 13 entries." },
  { "id": "A22",    "read_at": "2026-07-30T12:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "500-520", "why_it_governs": "Before a multi-commit closure, every cited asset must be paired with an in-session re-read timestamp — no citing labels I didn't actually consult this session.", "how_this_build_will_embody_it": "The manifest pairs each clause with a this-session read_at." },
  { "id": "A24",    "read_at": "2026-07-30T12:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "540-560", "why_it_governs": "Don't manufacture work; honest completion is valid — I told the founder plainly 'no, I have NOT built the comprehensive system' rather than dress up the two small additions as the deliverable.", "how_this_build_will_embody_it": "This build is scoped as pillar 1 of N, explicitly NOT the whole system; the remaining pillars are named as pending." },
  { "id": "A28",    "read_at": "2026-07-30T12:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "620-645", "why_it_governs": "Precedent decides — Sales Coach's dedicated Coaching tab is the established pattern for a module's 'make it yours' config; C.A.R.E should mirror it rather than invent a new placement.", "how_this_build_will_embody_it": "A dedicated /settings/ai tab + first-position landing card, mirroring the Coaching tab." },
  { "id": "A30",    "read_at": "2026-07-30T12:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "660-685", "why_it_governs": "Encode the gate structurally, not in prose — the two Saves must be provably disjoint, not merely 'we'll remember not to overlap'.", "how_this_build_will_embody_it": "The Widget Save literally no longer contains the 4 AI keys; the AI page PATCHes only those 4 — disjoint by construction, verified by typecheck." },
  { "id": "A31",    "read_at": "2026-07-30T12:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "700-725", "why_it_governs": "Schema-complete ≠ built — a settings tab that renders but whose Save is dead, or that no nav links to, is not built.", "how_this_build_will_embody_it": "The tab is reachable (SettingsTabs + landing card), loads config, and its Save writes the 4 fields end-to-end; the panels keep their own working endpoints." },
  { "id": "A34",    "read_at": "2026-07-30T12:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "760-785", "why_it_governs": "Migration-coupled code must degrade, not assert — but this build adds NO migration; it reuses the existing tenant-config columns.", "how_this_build_will_embody_it": "No new column; the AI page reads existing config fields with null-safe defaults, so it degrades trivially if a field is absent." },
  { "id": "A38",    "read_at": "2026-07-30T12:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "820-845", "why_it_governs": "Verified = a named command, not a feeling — the 'don't break it' constraint demands a real check that the trimmed Widget page + new AI page compile.", "how_this_build_will_embody_it": "npx tsc --noEmit → exit 0 (recorded in closure.md)." }
]
```

## 5. Hypotheses

1. Moving the 4 AI keys off the Widget Save + into the AI page's Save makes them disjoint → no clobber. (Verified: typecheck clean; no dangling refs.)
2. A dedicated first-position tab + first landing card fixes the discoverability defect (layer 3/4).
3. The self-contained panels (JeffGuidancePanel, AdaptiveKnowledgePanel) move without change (own endpoints).
