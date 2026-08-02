---
tbc_version: 1
trigger: fix
started_at: 2026-08-02T00:45:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — KPI compute-cron: a dropped snapshot must not be invisible

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (sha256sum in build.md). Both present in
the working tree; the relevant principles were read this session.

## 2. Why (§2 diagnose, §3.4 honesty)
The KPI compute-cron persists each agent's Layer-1/2 metrics by, per (agent, metric, period), DELETING the
existing `kpi_snapshot` row then INSERTING the fresh one. The insert result was handled `if (!insErr) snapshots
+= 1;` — the failure branch was empty. So a failed insert leaves that metric with NO snapshot (the delete
already ran) and NO signal anywhere: not logged, not counted, not in the response. In a subsystem whose whole
purpose is honest §3.5 metrics, a silently-dropped KPI is the exact failure the thesis forbids. A *persistent*
insert failure (a bad value, a future constraint) would produce zero snapshots run after run with no trace.

Root cause (§2): the write-outcome was checked for the success path but the failure path was swallowed — not a
compute error, a surfacing error. The gap self-heals on the next run (re-delete + re-insert), so it is a
visibility bug, not permanent loss — but invisibility is itself the defect here.

## 3. Design + interconnection (§1.5.1-style ripple)
Mirror the sibling crons that already do this right — retention's `storageErrors`, purge's `assetErrors`: add a
`snapshotErrors` counter, increment + `console.error` on `insErr`, and return it. No compute change, no schema,
no auth change; the happy path is identical. Ripple: the response shape gains one field (`snapshotErrors`),
which is additive.

## 4. Class sweep (A26)
Swept all 7 crons for swallowed write errors. The good pattern (retention: `else storageErrors += 1`; purge:
`assetErrors`/`malformed` surfaced with explicit §3.4 reasoning; backfill/task-overrun/durability: outer
try/catch; finance deliver-cron: fixed last commit). The KPI cron was the SOLE remaining instance of a
write-error swallowed with neither a counter nor a log. Class boundary closed with this fix.

## 5. Hypothesis
- **H1:** on an insert failure, the run now logs it, increments `snapshotErrors`, and returns it non-zero; the
  happy path still increments `snapshots`; typecheck clean.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-02T00:45:00Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understanding precedes solving — I read the delete-then-insert + the swallowed branch to see WHY a drop is invisible before changing it.", "how_this_build_will_embody_it": "Section 2 states the root cause (swallowed failure path) from the code." },
  { "id": "§0.1", "read_at": "2026-08-02T00:45:00Z", "source_file": "CLAUDE.md", "line_range": "26-40", "why_it_governs": "Methodology in the tree, consulted this session.", "how_this_build_will_embody_it": "Doc integrity MATCH." },
  { "id": "§2", "read_at": "2026-08-02T00:45:00Z", "source_file": "CLAUDE.md", "line_range": "150-170", "why_it_governs": "Diagnose before patching.", "how_this_build_will_embody_it": "Section 2 names it a surfacing bug, not a compute bug." },
  { "id": "§3.4", "read_at": "2026-08-02T00:45:00Z", "source_file": "CLAUDE.md", "line_range": "280-292", "why_it_governs": "Honesty is the moat — a silently-dropped metric misrepresents the record.", "how_this_build_will_embody_it": "The fix makes every drop visible (counter + log + response field)." },
  { "id": "§1.5.1", "read_at": "2026-08-02T00:45:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic ripple trace before acting.", "how_this_build_will_embody_it": "Section 3 traces the ripple: one additive response field, no compute/schema/auth change." },
  { "id": "§1.5.2", "read_at": "2026-08-02T00:45:00Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search — hypothesised the swallow class, swept all 7 crons.", "how_this_build_will_embody_it": "Section 4 records the sweep; only the real instance is fixed." },
  { "id": "§3.3", "read_at": "2026-08-02T00:45:00Z", "source_file": "CLAUDE.md", "line_range": "250-262", "why_it_governs": "Guide, don't overtake — surface decisions rather than unilaterally deciding them.", "how_this_build_will_embody_it": "The two adjacent issues (timezone metric semantics, missing constraint) are FLAGGED, not changed under my own authority." },
  { "id": "§3.5", "read_at": "2026-08-02T00:45:00Z", "source_file": "CLAUDE.md", "line_range": "316-330", "why_it_governs": "Measurement rules — the metrics must be defensible and honest.", "how_this_build_will_embody_it": "A dropped snapshot is a corrupted measurement; surfacing its failure protects metric integrity." },
  { "id": "§6", "read_at": "2026-08-02T00:45:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "Diagnosed, swept, ripple-traced, why-explained." },
  { "id": "A19", "read_at": "2026-08-02T00:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology must live in the tree.", "how_this_build_will_embody_it": "Confirmed present before citing." },
  { "id": "A22", "read_at": "2026-08-02T00:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + Session-Reads trailer." },
  { "id": "A26", "read_at": "2026-08-02T00:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "67", "why_it_governs": "A found bug is a CLASS — sweep it.", "how_this_build_will_embody_it": "Section 4 swept all 7 crons; boundary closed." },
  { "id": "A30", "read_at": "2026-08-02T00:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "An inline comment states why the failure branch must stay surfaced." },
  { "id": "A38", "read_at": "2026-08-02T00:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes the typecheck output." }
]
```
