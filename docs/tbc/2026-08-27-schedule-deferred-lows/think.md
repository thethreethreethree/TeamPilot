---
started_at: 2026-08-27T12:07:00+08:00
---

# THINK — schedule audit: the deferred LOW findings (founder-greenlit)

## Why (the record)
The schedule audit's closure R1 recorded five LOW findings the founder scoped OUT of the first batch. The founder then
directed (picker) to work them, "starting with the upload cap." These are all verified findings from the audit — not
new hypotheses — so this is executing acknowledged work, in the order the founder chose.

## The fixes (§1.5 organic/holistic — each minimal, each gated)
- **Upload cap (§1.5.1 layer 2).** The binary import advertised a 4.5 MB limit but the base64 body (≈1.37× + JSON
  envelope) exceeds Vercel's ~4.5 MB request cap near that size — so a legit multi-week roster file was rejected by the
  PLATFORM with an opaque 413 before our handler ran. A "doesn't work as advertised" gap, not polish. Fix: a shared
  `uploadLimits.ts` (single source: `MAX_UPLOAD_BYTES` 3 MB + `MAX_UPLOAD_BASE64_CHARS` backstop), a CLIENT pre-flight
  on the raw file (clear "file is X MB, limit 3 MB" message), and the two route caps corrected from the lying 6 MB.
- **Printed unassigned-shift warning (§3.4 honesty).** The colour grid pivots by assignment, so a shift with NOBODY
  assigned renders no cell — the printed/PNG page looked fully staffed while the screen showed an amber banner. Fix:
  the export footer now carries "⚠ N shift(s) have no one assigned" (from the same `emptyShiftsThisWeek` the screen uses).
- **PDF non-Latin names (§3.4 honesty).** The re-importable table PDF sets Helvetica/WinAnsi and writes 1 byte/char, so
  "José"/"李伟" were silently mangled. Fix: `pdfText` transliterates diacritics (José→Jose, round-trippable) and maps a
  non-Latin-1 char to a visible '?' — never corrupt bytes.
- **xlsx column amplification (robustness).** A crafted cell ref (`r="XFD1"` → column 16383) back-filled a 16k-element
  row per row, amplifying past the entry-size decompression guard. Fix: `MAX_XLSX_COLS` (256) bounds the sparse fill.
- **Rate-limit the replay GETs.** The events + coverage GETs replay the full log on every call but weren't limited
  (their mutations were). Fix: a 60/min limit on each, matching the siblings.

## Gate (A30) — every fix that has a pure seam is locked
`uploadLimits` (message + a truthful-cap invariant test), `pdfText` (transliterate + placeholder + PDF-escape),
`xlsxSheetToCells` (a far-right ref stays bounded, not 16k). The renderer footer + the GET rate-limits have no pure
seam (canvas / a one-line limiter matching 27 siblings) — bounded honestly in the closure.

## Session-read manifest (A22 — read_at ≥ started_at 12:07:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T12:33:00+08:00",
    "why_it_governs": "Understand each finding from the audit record before fixing.",
    "how_this_build_will_embody_it": "Each fix executes a verified audit finding, in the founder's chosen order." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T12:33:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session (12:33)." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-27T12:33:10+08:00",
    "why_it_governs": "Organic + Holistic — minimal fixes; the upload limit is single-sourced so client + server can't drift.",
    "how_this_build_will_embody_it": "uploadLimits.ts is the one source for the client pre-check and both route caps." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "89-92", "read_at": "2026-08-27T12:33:15+08:00",
    "why_it_governs": "Layer 2 — the import must actually accept the file sizes it advertises.",
    "how_this_build_will_embody_it": "The real ~3 MB ceiling is enforced client-side with a clear message, not an opaque platform 413." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "150-152", "read_at": "2026-08-27T12:33:20+08:00",
    "why_it_governs": "These are the audit follow-ups — surfaced, not silently skipped.",
    "how_this_build_will_embody_it": "The deferred R1 items are now built + gated, in the founder's chosen order." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-27T12:33:25+08:00",
    "why_it_governs": "Guide-don't-overtake — I did NOT do these until the founder greenlit them (they'd deferred them).",
    "how_this_build_will_embody_it": "Built only after the founder's picker chose 'deferred LOWs, start upload cap'." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T12:33:30+08:00",
    "why_it_governs": "Honesty — the printed page mustn't look fully staffed when it isn't; a name mustn't silently mangle.",
    "how_this_build_will_embody_it": "The export footer flags unassigned shifts; pdfText yields a readable name or a visible '?'." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T12:33:35+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: acted on verified findings in founder-chosen order, gated each pure seam." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-27T12:33:40+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-27T12:33:45+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-27T12:33:50+08:00",
    "why_it_governs": "A lesson recorded only in prose returns — each fix's class must be encoded in a gate that fails without my cooperation, not just described.",
    "how_this_build_will_embody_it": "uploadLimits (truthful-cap invariant), pdfText (transliterate/placeholder), and the xlsx col-cap each carry a failing-without-it test." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-27T12:33:55+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + EXIT code." }
]
```
