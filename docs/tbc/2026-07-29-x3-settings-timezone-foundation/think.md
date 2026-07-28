---
tbc_version: 1
trigger: feat
started_at: 2026-07-29T07:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — Settings Slice 3 (Timezone): consumption foundation

Founder chose "wire consumption FIRST" (2026-07-29) after the audit found `companies.timezone` is
stored but never consumed. This slice ships the reusable, testable formatter + its first real consumer;
broad adoption + the per-user override column follow.

## 1. Document integrity (§0.1)

Live hashes MATCH DOC_MANIFEST.json (unchanged). Proceed.

## 2. Why (from the record — §0)

`companies.timezone` (0009) is read only by the Settings page that edits it — grep found NO timestamp
display formatting with it, and timestamp rendering is scattered across ~12 files as ad-hoc
`toLocaleString()` / `.slice(0,19)` with no shared util. So the stored zone does nothing and every
display re-invents formatting. Consumption must come before a per-user override, or the override is dead
surface (the exact class the founder's audit surfaced).

## 3. Session-read manifest (A22)

```json
[
  { "id": "§0",     "read_at": "2026-07-29T07:10:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understand before building — grepped the actual consumers of companies.timezone (none) before adding an override, so the fix targets the real gap (unconsumed value), not the assumed one.", "how_this_build_will_embody_it": "Section 2 states the unconsumed-value finding from grep." },
  { "id": "§0.1",   "read_at": "2026-07-29T07:10:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the working tree, read this session.", "how_this_build_will_embody_it": "This-session read_at values." },
  { "id": "§1.5.1", "read_at": "2026-07-29T07:10:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — a pure formatter (structure) that actually renders differently per zone (effectivity) and is wired into a real display (composition).", "how_this_build_will_embody_it": "Section 5 walks the layers; the util is proven to honor the zone by test." },
  { "id": "§1.5.2", "read_at": "2026-07-29T07:10:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Think then search — hypothesised 'timezone unconsumed' then confirmed by grepping the display sites.", "how_this_build_will_embody_it": "Hypotheses carry confirmed outcomes." },
  { "id": "§6",     "read_at": "2026-07-29T07:10:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — scope honestly: ship the primitive + ONE consumer, not a risky 12-file refactor at the tail of a long session.", "how_this_build_will_embody_it": "One consumer wired (Settings last-saved); broad adoption is the next increment, stated." },
  { "id": "A19",    "read_at": "2026-07-29T07:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree.", "how_this_build_will_embody_it": "This-session reads recorded." },
  { "id": "A22",    "read_at": "2026-07-29T07:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "Every cited id resolves to a this-session entry; commit uses Session-Reads Form A." },
  { "id": "A26",    "read_at": "2026-07-29T07:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-715", "why_it_governs": "The dead-surface class: a stored value with no consumer. Wiring a consumer is the class fix; adding an override without one would REPRODUCE the class.", "how_this_build_will_embody_it": "The stored companies.timezone gets its first consumer; the per-user override is deferred UNTIL consumption exists." },
  { "id": "A28",    "read_at": "2026-07-29T07:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "A precedent decides the shape: finance/format.ts is the existing 'shared pure formatter' pattern. datetime/format.ts follows it rather than inventing a new convention.", "how_this_build_will_embody_it": "formatInTimeZone lives in src/lib, pure + unit-tested, like finance/format.ts." },
  { "id": "A31",    "read_at": "2026-07-29T07:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-817", "why_it_governs": "Schema-complete is not built — a formatter with no consumer is a nonexistent feature.", "how_this_build_will_embody_it": "The util is wired into a real display (read-path), not just exported." },
  { "id": "A30",    "read_at": "2026-07-29T07:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — the zone-resolution precedence is a pure, unit-pinned function.", "how_this_build_will_embody_it": "resolveTimeZone + formatInTimeZone tested (8 assertions)." },
  { "id": "A38",    "read_at": "2026-07-29T07:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a command — closes after npm run check.", "how_this_build_will_embody_it": "closure.md pastes the canonical command output + exit 0." }
]
```

## 4. Hypotheses

```json
[
  { "id": "H1", "claim": "A pure formatter that takes an IANA zone renders the SAME instant differently per zone, proving it actually honors the timezone (unlike the prior raw UTC slice).", "confidence": "high", "test": "formatInTimeZone(noonUTC, 'Asia/Manila') !== formatInTimeZone(noonUTC, 'America/New_York').", "outcome": "CONFIRMED — format test asserts the two differ; 8/8 pass." },
  { "id": "H2", "claim": "A bad/typo'd companies.timezone must NOT crash the page — it should degrade to local time.", "confidence": "high", "test": "formatInTimeZone(iso, 'Mars/Phobos') returns a non-empty string (catch → local).", "outcome": "CONFIRMED — the RangeError is caught and re-formatted without the zone; test asserts non-empty." }
]
```

## 5. Four-layer pre-walk (§1.5.1)

- **1 structure:** one pure module (`src/lib/datetime/format.ts`) — `formatInTimeZone` + `resolveTimeZone`.
- **2 effectivity:** proven to honor the zone (per-zone difference) + degrade on a bad zone, by test.
- **3 composition:** wired into the Settings "Last saved" stamp (its first real consumer); reusable by the
  other ~12 display sites as they adopt it. No existing display's behavior changed except this one.
- **4 surface:** the "Last saved" stamp now reads in the company's zone instead of a raw UTC slice.

**verdict: SHIPPABLE** (foundation + one consumer; broad adoption + per-user override are next increments).
