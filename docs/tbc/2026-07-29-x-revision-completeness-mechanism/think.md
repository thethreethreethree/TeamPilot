---
tbc_version: 1
trigger: feat
started_at: 2026-07-29T05:10:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — revision-completeness mechanism (permanent fix for "reported done while partial")

The founder named a recurring failure critical: a revision (often from a marked-up image/PDF) reported
DONE while a subset was never implemented. Sibling request: a durable record of what was left unfinished
+ its risks, for interruption/internet-loss resilience. This build delivers both as structure, not prose.

## 1. Document integrity (§0.1)

Live hashes of CLAUDE.md + ThinkerThinker.md MATCH DOC_MANIFEST.json (unchanged this build). Proceed.

## 2. Root cause (diagnosed from the record, §0)

From the sales-coach incident closure (RES-01), the class has three causes, none an implementation slip:
- **(a) lossy capture** — enumerating every discrete change from an image is imperfect; struck REMOVALS
  are non-salient vs additions, so they drop.
- **(b) no traceability** — nothing maps each requested change to its implementation, so a partial build
  looks complete.
- **(c) interruption loss** — no durable "what's left + risks" record, so a resume treats the partial as done.

A prose promise ("I'll be more careful") cannot fix a class (A30). The fix must be a structure that fails
without the author's cooperation, where such a structure can be precise (A33).

## 3. Session-read manifest (A22)

```json
[
  { "id": "§0",     "read_at": "2026-07-29T05:15:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding precedes solving — the fix is built on the diagnosed root cause of the class, read from the sales-coach closure, not on a preference to be more careful.", "how_this_build_will_embody_it": "Section 2 states the three causes from the record before any mechanism is proposed." },
  { "id": "§0.1",   "read_at": "2026-07-29T05:15:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology must be in the working tree and read this session, not cited from cached labels.", "how_this_build_will_embody_it": "Doc hashes verified; this manifest carries this-session read_at values." },
  { "id": "§1.5.1", "read_at": "2026-07-29T05:15:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — the mechanism's own effectivity (layer 2) is proven by a detection test, not assumed from the code existing.", "how_this_build_will_embody_it": "check.md runs the gate against a deliberately-bad manifest and shows it fails, then green when honest." },
  { "id": "§1.5.2", "read_at": "2026-07-29T05:15:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Think then search — the gate design was hypothesised then confirmed against the existing gate idiom (residual/freshness) before writing.", "how_this_build_will_embody_it": "Hypotheses below carry confirmed outcomes; the gate mirrors verify-residual's binds-at-closure shape." },
  { "id": "§6",     "read_at": "2026-07-29T05:15:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — am I guiding or overtaking? Making a gate MANDATORY is a governance act, so it is proposed for ratification, not self-imposed.", "how_this_build_will_embody_it": "M6/M7 deferred to AMD-009 ratification; the runnable gate + ledger ship now." },
  { "id": "A19",    "read_at": "2026-07-29T05:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree — the assets governing this build were read from the tree this session.", "how_this_build_will_embody_it": "A26/A30/A33/A36 read at their real line ranges this session." },
  { "id": "A22",    "read_at": "2026-07-29T05:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "A citation without a session read is an undetected violation.", "how_this_build_will_embody_it": "Every cited id resolves to a this-session entry; commit uses Session-Reads Form A." },
  { "id": "A26",    "read_at": "2026-07-29T05:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-715", "why_it_governs": "The founder invoked this: a reported bug is one instance of a class. The sales-coach miss is one instance; the fix targets the CLASS, not the instance.", "how_this_build_will_embody_it": "The mechanism binds all future revision builds, and is retro-applied to the motivating incident." },
  { "id": "A30",    "read_at": "2026-07-29T05:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — the class must be encoded in a gate that fails without the author's cooperation.", "how_this_build_will_embody_it": "verify-revision.mjs fails closure on any un-dispositioned requested change." },
  { "id": "A33",    "read_at": "2026-07-29T05:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "850-869", "why_it_governs": "A gate must be PRECISE or not exist — 'this was a founder revision' is not mechanically detectable without false positives, so the manifest is enforced when present and the hole is named when absent.", "how_this_build_will_embody_it": "The gate enforces declared-set completeness (precise, green when honest) and records the un-declarable-item hole rather than shipping a noisy detector." },
  { "id": "A36",    "read_at": "2026-07-29T05:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "921-957", "why_it_governs": "The residual you wrote is the highest-yield queue — the ledger + manifest ARE that queue for revision scope, maintained not written as a disclaimer.", "how_this_build_will_embody_it": "docs/BUILD-STATE.md is read first on resume; deferred items must appear in it (gate REV-6)." },
  { "id": "A38",    "read_at": "2026-07-29T05:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a claim about a command — a 'done' item must point to evidence.", "how_this_build_will_embody_it": "Gate REV-4 fails a 'done' item with no evidence; closure pastes the npm run check output + exit code." }
]
```

## 4. Hypotheses

```json
[
  { "id": "H1", "claim": "A precise gate CAN block 'reported done while partial' by requiring every DECLARED requested change to reach a disposition before closure — even though it cannot detect an UN-declared change.", "confidence": "high", "test": "Build the gate; run it against a manifest with an un-dispositioned item (must fail) and against an all-done manifest (must pass).", "outcome": "CONFIRMED — see check.md detection test: REV-3 fires on the bad item, exit 1; green when all dispositioned, exit 0." },
  { "id": "H2", "claim": "Making the gate mandatory now would overtake a governance decision (AMD-008 precedent routes mandatory gates through founder ratification), so the right ship is: runnable gate + live ledger now, mandatory-wiring proposed via AMD-009.", "confidence": "high", "test": "Check AMD-008's process; confirm INV12 counts only ratified amendments so a proposed AMD-009 keeps the build green.", "outcome": "CONFIRMED — AMD-008 was ratified + edited the constitution; a proposed AMD-009 leaves constitution.ts untouched and INV12 green. Gate left out of the mandatory chain until ratified." }
]
```

## 5. Four-layer pre-walk (§1.5.1)

- **1 structure:** two artifacts — a durable ledger (docs/BUILD-STATE.md) + a per-build manifest
  (revision.md) enforced by one small gate that mirrors the existing residual gate's shape.
- **2 effectivity:** proven by a detection test (the gate must FAIL on a bad manifest), not by the file
  existing.
- **3 composition:** the ledger is the resume surface; the manifest feeds it; the protocol doc makes both
  run every build. No existing gate or workflow is disturbed (the gate is additive + runnable, not yet in
  the mandatory chain).
- **4 surface:** the ledger reads top-down as "what's left + risks"; the founder ratifies mandatory status
  with one word.

**verdict: SHIPPABLE** (runnable mechanism + live ledger now; mandatory-wiring proposed).
