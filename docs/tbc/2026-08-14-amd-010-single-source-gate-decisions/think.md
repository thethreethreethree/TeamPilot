---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T13:00:00Z
doc_hashes:
  CLAUDE.md: 4c73f753fa63b5f81fec5731b6dadbabe3d1b95665a121427e38b27372edd5d9
  ThinkerThinker.md: 52857f881adc1ea6e77cf7f76d2ffd475eb34cb0afc6b58f78048c12d5ee0239
manifest_entries: 19
hypotheses: 1
---

# THINK — AMD-010: encode the single-source-decision rule so the gate-drift class cannot recur

## 1. Document integrity (§0.1) — MATCH (post-edit)
This build EDITS the governing docs (§7), so the hashes recorded here are the POST-edit hashes, and
DOC_MANIFEST.json is regenerated to match (that is the permitted §7 consequence of a ratified amendment).
CLAUDE.md (4c73f7…) + ThinkerThinker.md (52857f…) verified against the regenerated manifest.

## 2. Why (founder directive 2026-08-14)
"Provide the root cause … create an amendment that will prevent this type of issue from happening again."
Root cause of the account-based empty-AI outage: the §3.4 gate DECISION was authored correctly in runBrainCall
but RE-DERIVED by the call() consumer, which dropped the controlExempt term and discarded the real answer. The
constitution had no rule against re-deriving a decision an authority already made — a structural gap (the §7
structural-gap exception). AMD-010 fills it.

## 3. What changed
- `docs/amendments/AMD-010-single-source-gate-decisions.md` — the amendment record (append-only, §7), ratified
  by founder directive, structured through the §7 soundness gate.
- `CLAUDE.md` §2 — "Single-source decisions — consume the verdict, don't re-derive the gate" (references AMD-010).
- `ThinkerThinker.md` A40 — the operational lesson + future-use questions + code smells (TOC + header updated).
- `src/lib/constitution.ts` — Invariant-12 registry sync: amendmentCount 7→8, lastAmendmentId AMD-008→AMD-010,
  version 1.8→1.10, date + title. (8 ratified: 001–006, 008, 010; 007/009 are PROPOSED.)
- `docs/tbc/DOC_MANIFEST.json` — regenerated hashes for both governing docs.

## 4. Interconnections traced (§1.5 / §7 ripple)
- Reinforces §1.5 (holistic ripple now explicitly covers re-derived decisions), §3.2 + §3.4 (structural gates
  encoded ONCE + consumed), §2 (no error loops — the record broke the wrong theory). No section weakened; no
  new contradiction (the ripple-trace lives in AMD-010).
- Invariant 12 (constitution metadata) + verify-docs (DOC_MANIFEST) are the two registries that MUST move when
  the constitution or amendment record changes; both updated here — else the build reports a constitution state
  that isn't true (the honesty drift Invariant 12 exists to catch).

## 5. Hypothesis (§1.5.2)
- **H1 — does the full gate stay green after editing both governing docs + the constitution constant?** The two
  drift-guards (Invariant 12 amendmentCount/lastAmendmentId; verify-docs manifest hashes) must PASS with the new
  values, proving the registries are in sync. Verified by `npm run check` (closure.md).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T13:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understanding precedes solving — the amendment encodes the root cause, diagnosed from the prod record.", "how_this_build_will_embody_it": "AMD-010's trigger + diagnosis are the evidenced root cause, not a preference." },
  { "id": "§0.1", "read_at": "2026-08-14T13:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Post-edit hashes verified against the regenerated manifest." },
  { "id": "§1.5", "read_at": "2026-08-14T13:01:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — editing the constitution touches two drift-guard registries (Invariant 12 + DOC_MANIFEST).", "how_this_build_will_embody_it": "Both registries updated in the same commit; gate proves sync." },
  { "id": "§1.5.1", "read_at": "2026-08-14T13:01:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 effectivity — an amendment that isn't wired into its enforcing registries is a doc that looks ratified but isn't reflected in the product's honest self-report.", "how_this_build_will_embody_it": "constitution.ts + manifest carry the change so /api/health reports it truthfully." },
  { "id": "§1.5.2", "read_at": "2026-08-14T13:02:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK then verify — the registries were updated then the gate run to confirm the drift-guards pass.", "how_this_build_will_embody_it": "H1 gated by npm run check." },
  { "id": "§2", "read_at": "2026-08-14T13:02:20Z", "source_file": "CLAUDE.md", "line_range": "208-250", "why_it_governs": "How the agent builds — §2.2 is added here; 'no error loops' governed the re-diagnosis when the starvation theory didn't hold.", "how_this_build_will_embody_it": "§2.2 added under §2; the amendment encodes the no-re-derive discipline as build behavior." },
  { "id": "§3.2", "read_at": "2026-08-14T13:02:25Z", "source_file": "CLAUDE.md", "line_range": "261-268", "why_it_governs": "The Understanding Gate is structural — a structural gate re-implemented in two places is only as strong as its most-drifted copy.", "how_this_build_will_embody_it": "§2.2 requires the gate be encoded ONCE and consumed, so a second copy cannot invert it." },
  { "id": "§3.4", "read_at": "2026-08-14T13:02:28Z", "source_file": "CLAUDE.md", "line_range": "282-300", "why_it_governs": "The control window IS the §3.4 gate whose decision was re-derived and inverted by the consumer — the triggering incident.", "how_this_build_will_embody_it": "The amendment names the §3.4 gate as the worked example and encodes against re-deriving it." },
  { "id": "§6", "read_at": "2026-08-14T13:02:30Z", "source_file": "CLAUDE.md", "line_range": "352-420", "why_it_governs": "Checklist — trace ripple before committing a constitutional change.", "how_this_build_will_embody_it": "Ripple enumerated in AMD-010 §7 + section 4." },
  { "id": "§7", "read_at": "2026-08-14T13:03:00Z", "source_file": "CLAUDE.md", "line_range": "410-455", "why_it_governs": "The amendment process — default deny, soundness gate, append-only trail, edit-only-under-amendment.", "how_this_build_will_embody_it": "AMD-010 passes all six §7 checks; CLAUDE.md edit references the AMD; the AMD file is the append-only record." },
  { "id": "§2.1", "read_at": "2026-08-14T13:03:05Z", "source_file": "CLAUDE.md", "line_range": "235-250", "why_it_governs": "The Standing build protocol subsection §2.2 is placed immediately after — this build follows that protocol.", "how_this_build_will_embody_it": "§2.2 added directly after §2.1; the amendment build ran the TBC protocol." },
  { "id": "§2.2", "read_at": "2026-08-14T13:03:08Z", "source_file": "CLAUDE.md", "line_range": "251-276", "why_it_governs": "The new rule this build adds — consume the verdict, don't re-derive the gate.", "how_this_build_will_embody_it": "Authored as §2.2, backed by AMD-010, with the outage as the worked example." },
  { "id": "§7.2", "read_at": "2026-08-14T13:03:12Z", "source_file": "CLAUDE.md", "line_range": "418-440", "why_it_governs": "The six-check soundness gate an amendment must pass.", "how_this_build_will_embody_it": "AMD-010 answers all six checks (trigger, diagnosis, ripple, alternative, outside-view, no-soften)." },
  { "id": "§7.3", "read_at": "2026-08-14T13:03:15Z", "source_file": "CLAUDE.md", "line_range": "441-447", "why_it_governs": "Append-only audit trail — the AMD file records the decision, never edited in place.", "how_this_build_will_embody_it": "AMD-010 is a new append-only file in docs/amendments/." },
  { "id": "§7.4", "read_at": "2026-08-14T13:03:18Z", "source_file": "CLAUDE.md", "line_range": "448-453", "why_it_governs": "CLAUDE.md may be edited ONLY as the consequence of a ratified amendment, referencing its ID.", "how_this_build_will_embody_it": "The §2.2 edit references AMD-010; the commit message cites it; DOC_MANIFEST regenerated as the permitted consequence." },
  { "id": "A19", "read_at": "2026-08-14T13:03:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree assets before changing them.", "how_this_build_will_embody_it": "Read AMD-008 format, the A39 entry format, Invariant 12, and verify-docs before editing." },
  { "id": "A22", "read_at": "2026-08-14T13:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Assets read this session before citing." },
  { "id": "A30", "read_at": "2026-08-14T13:04:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate — a lesson in prose returns.", "how_this_build_will_embody_it": "The class is encoded as CLAUDE.md §2 + A40 + the interim regression test; AMD-010 requires the verdict-return pattern + a both-branches drift-guard test." },
  { "id": "A38", "read_at": "2026-08-14T13:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes npm run check + exit code." }
]
```
