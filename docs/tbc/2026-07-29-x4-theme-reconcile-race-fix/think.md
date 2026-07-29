---
tbc_version: 1
trigger: fix
started_at: 2026-07-29T07:40:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — fix a reconcile race in the theme slice (found by post-build self-audit)

Applying the outside-view stance and a ground-up pass, I audited THIS session's shipped code before
building more. The adversarial re-read of ThemeProvider (03bc57d4) surfaced a real race.

## 1. Document integrity (§0.1)

Live hashes MATCH DOC_MANIFEST.json. Proceed.

## 2. The bug (from the code, §0)

The DB-reconcile effect captures `localRaw` at mount (null when the device has no stored choice), then
fetches `/api/me/theme` and applies the DB/company value. But it passed the STALE `localRaw: null` to
`reconcileTheme` after the async fetch resolved. If the user picks a theme WHILE the fetch is in flight
(setPreference writes localStorage synchronously), reconcileTheme still sees `localRaw: null`, so it
applies the DB/company value and silently REVERTS the user's fresh choice. A network-latency-sized window
(~100–500ms) on a fresh device.

## 3. Session-read manifest (A22)

```json
[
  { "id": "§0",     "read_at": "2026-07-29T07:45:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Diagnose before patching — the race was read out of the effect's control flow (stale captured localRaw vs an async apply) before the fix.", "how_this_build_will_embody_it": "Section 2 states the exact clobber sequence from the code." },
  { "id": "§0.1",   "read_at": "2026-07-29T07:45:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the working tree, read this session.", "how_this_build_will_embody_it": "This-session read_at values." },
  { "id": "§1.5.1", "read_at": "2026-07-29T07:45:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Layer 2 effectivity — the feature 'worked' in the happy path but broke under a real interaction (mid-flight choice); the audit tests the invoked-for-real behavior.", "how_this_build_will_embody_it": "The fix restores the user's choice under the race." },
  { "id": "§1.5.2", "read_at": "2026-07-29T07:45:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Proactive audit — I THOUGHT about how the async reconcile could fail, then confirmed by re-reading the effect.", "how_this_build_will_embody_it": "This build IS the proactive post-build audit's output." },
  { "id": "§6",     "read_at": "2026-07-29T07:45:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — trace ripple: the fix is localised to the effect, does not touch the pure reconcileTheme or the route.", "how_this_build_will_embody_it": "One re-read guard added; nothing else changed." },
  { "id": "A19",    "read_at": "2026-07-29T07:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree.", "how_this_build_will_embody_it": "This-session reads recorded." },
  { "id": "A22",    "read_at": "2026-07-29T07:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "Cited ids resolve to this-session entries; commit uses Session-Reads Form A." },
  { "id": "A26",    "read_at": "2026-07-29T07:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-715", "why_it_governs": "The bug is one instance of a class: an async callback applying state computed from a value captured before an await, clobbering a synchronous change made in between. The sweep checks the sibling reconcile paths.", "how_this_build_will_embody_it": "check.md sweeps the ThemePanel + persist paths for the same capture-before-await shape." },
  { "id": "A30",    "read_at": "2026-07-29T07:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A fix is not complete until the class is gated or the gate is honestly declined.", "how_this_build_will_embody_it": "remediate.md answers gate-or-promise (declined per A33, with the reason)." },
  { "id": "A33",    "read_at": "2026-07-29T07:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "850-869", "why_it_governs": "A gate must be precise or not exist — 'a value captured before an await is later stale' is not mechanically detectable without false positives across the codebase.", "how_this_build_will_embody_it": "The gate is declined; the guard is the re-read at apply time + the existing reconcileTheme 'local-wins' unit test." },
  { "id": "A38",    "read_at": "2026-07-29T07:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a command — closes after npm run check.", "how_this_build_will_embody_it": "closure.md pastes the canonical command output + exit 0." }
]
```

## 4. Hypotheses

```json
[
  { "id": "H1", "claim": "Re-reading localStorage AFTER the fetch resolves and skipping when it is non-null closes the race without regressing the fresh-device path.", "confidence": "high", "test": "tsc + the existing reconcileTheme test (local-set -> skip) + trace: fresh device (freshRaw null) still applies DB/company; mid-flight choice (freshRaw set) now skips.", "outcome": "CONFIRMED — tsc exit 0; the re-read passes the FRESH value to reconcileTheme, whose local-set branch (unit-tested) returns {preference:null} so the clobber cannot happen." }
]
```

## 5. Scope

One guard added to the reconcile effect. No API, schema, or pure-logic change. Non-breaking.
