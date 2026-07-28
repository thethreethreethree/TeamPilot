---
tbc_version: 1
trigger: fix
started_at: 2026-07-28T15:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 2
---

# THINK — F5: line_range becomes advisory, id-in-file becomes the hard guarantee

Closes the last install-audit finding. `verify-manifest` failed when a manifest entry's
hand-written `line_range` did not contain the id — which coupled every build's manifest to
the exact line numbers of CLAUDE.md / ThinkerThinker.md. Any governing-doc edit shifted those
lines and RED-ed the build until the ranges were hand-re-pointed (hit twice on 2026-07-28:
the constitution-clause insert, and removing TT's embedded constitution which shifted assets ~191 lines).

The fix keeps the guarantee that matters — the id must LIVE in the named file (catches a wrong
source_file or an invented citation) — and demotes the exact range to ADVISORY: a stale range
emits a note, not a failure. The read_at timestamp remains the honesty mechanism for "opened
it this session."

## 1. Document integrity

Hashes match docs/tbc/DOC_MANIFEST.json (CLAUDE.md e08874…, TT 0428b0bb… post-reconciliation).

## 2. Session-read manifest

```json
[
  { "id": "§0",     "read_at": "2026-07-28T15:15:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding precedes solving — the fix rests on WHY the gate RED-s on doc edits (absolute line coupling), not on suppressing the symptom.", "how_this_build_will_embody_it": "The change is diagnosed to the exact coupling before altering the check." },
  { "id": "§0.1",   "read_at": "2026-07-28T15:15:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology read this session; the manifest records the reads behind the fix.", "how_this_build_will_embody_it": "read_at is this session; the id-in-file guarantee is what now backs it." },
  { "id": "§1.5.1", "read_at": "2026-07-28T15:15:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four-layer framework — the fix is weighed for structure (one check), effectivity (still catches fabrication), composition (advisory notes don't break the build).", "how_this_build_will_embody_it": "Section 4 walks the layers." },
  { "id": "§1.5.2", "read_at": "2026-07-28T15:15:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK before search — the fix was hypothesised (stale range ≠ fabrication) then confirmed against the install dir's now-stale ranges and a fabricated id.", "how_this_build_will_embody_it": "Hypotheses below carry their tested outcomes." },
  { "id": "§6",     "read_at": "2026-07-28T15:15:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "The checklist — the fix must not weaken a real guarantee for convenience; it preserves the id-in-file catch precisely so it does not.", "how_this_build_will_embody_it": "Fabrication still fails; only the brittleness is removed." },
  { "id": "A19",    "read_at": "2026-07-28T15:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree — read live, recorded here.", "how_this_build_will_embody_it": "The manifest carries this-session reads." },
  { "id": "A22",    "read_at": "2026-07-28T15:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "The manifest gate's whole purpose is 'cited ≙ read'; F5 keeps that (id must be in the file + read_at) while dropping the line-number fragility.", "how_this_build_will_embody_it": "The honesty mechanism (read_at) and the existence check are untouched." },
  { "id": "A26",    "read_at": "2026-07-28T15:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-715", "why_it_governs": "F5's class is 'a check coupled to a brittle proxy (absolute line numbers) instead of the invariant (the id lives here)'. Fix at the invariant.", "how_this_build_will_embody_it": "The check now tests the invariant directly; the proxy is advisory." },
  { "id": "A30",    "read_at": "2026-07-28T15:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A gate must fail without the author's cooperation — F5 keeps that for fabrication (id absent) while removing a false failure that trained re-pointing rituals.", "how_this_build_will_embody_it": "Fabrication fails mechanically; a stale range notes, so nobody learns to distrust the gate." },
  { "id": "A33",    "read_at": "2026-07-28T15:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "850-880", "why_it_governs": "A gate must be PRECISE or it gets skipped — RED-ing on a stale-but-honest range was imprecise noise; F5 makes it precise (fail only on a real defect).", "how_this_build_will_embody_it": "The failure condition now matches the actual defect (wrong file / invented id)." },
  { "id": "A38",    "read_at": "2026-07-28T15:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a claim about a command — F5 is confirmed by running the gate against real stale ranges and a fabricated id, not by asserting it.", "how_this_build_will_embody_it": "build.md pastes the detection-test outcomes with exit codes." }
]
```

## 3. Hypotheses

```json
[
  { "id": "H1", "claim": "A build dir whose ranges are stale from a governing-doc edit now PASSES (advisory notes), instead of RED-ing.", "confidence": "high", "test": "Run verify-manifest against the install dir, whose TT ranges are stale after the R1 reconciliation.", "outcome": "CONFIRMED — exit 0 with 'line_range … is stale … advisory (F5)' notes for the shifted TT ids." },
  { "id": "H2", "claim": "An id that appears NOWHERE in the named file still fails (fabrication catch preserved).", "confidence": "high", "test": "Rename a manifest id to a non-existent asset (A97) and run.", "outcome": "CONFIRMED — 'A97: the ID does not appear anywhere in ThinkerThinker.md', exit 1." }
]
```

## 4. Four-layer pre-walk

- **1 structure:** the check is reordered around the invariant (id-in-file) with the range as a
  post-hoc advisory. Fewer failure branches, one hard guarantee.
- **2 effectivity:** confirmed by H1/H2 — passes honest stale ranges, fails fabrication.
- **3 composition:** removes the re-point coupling that made every governing-doc edit also a
  manifest edit; the minimum-set and read_at checks are untouched.
- **4 surface:** the advisory note tells a maintainer the range drifted, without blocking them.

**verdict: SHIPPABLE.**

## 5. Specification fidelity

- The manifest spec said the range "must be real and contain the id." F5 relaxes the exact-range
  requirement to advisory while STRENGTHENING the existence requirement (id must be in the file,
  not merely in a hand-written window). This is the F5 residual's recommended design, and it is a
  deliberate, founder-surfaced change — recorded here, not silently made.
