# Closure

## What shipped
The schedule Export menu now offers PNG + PDF (colour) for viewing/printing and **Excel, CSV, and a data-PDF
that all re-import** into the system, with a This-week / All-weeks scope toggle. Print and the colour PDF are
landscape. Every re-importable format is proven to round-trip against the real import readers.

## Residual (A36 — ranked)
```json
{ "id": "R1", "item": "The data-PDF paginates very wide/tall schedules into column-groups × row-pages; a schedule wider than ~13 date columns spans multiple page-groups, merged back by staff name on re-import.",
  "why_skipped": "The merge is implemented + covered for the single-group case; the multi-group merge relies on staff names being identical across page-groups (they are — same roster).",
  "confidence_it_does_not_matter": "high",
  "opened_at": "2026-08-20T16:05:00Z",
  "outcome": "OPENED + confirmed acceptable, with a real bound recorded: re-import merges page-groups by EXACT staff name (isoGridFromItems keys on the name string). If two people share a name, their cells across page-groups would merge onto one row — a pre-existing ambiguity of a name-keyed grid (the frendz parser has the same property), not new. The common case (unique names, ≤13 columns = up to ~2 weeks per page) round-trips exactly, which the tests pin. CSV/XLSX have no width bound, so they are the recommended re-import path for very wide schedules." }
```
```json
{ "id": "R2", "item": "csvSafe's neutralizeCsvFormula prefixes a cell that STARTS with =,+,-,@ (formula-injection defense). A staff NAME starting with one of those would be prefixed on export and read back slightly altered.",
  "why_skipped": "Security (CWE-1236) wins over a rare name shape; shift cells ('06:00-…') never start with those.",
  "confidence_it_does_not_matter": "medium",
  "opened_at": null,
  "outcome": "Left as-is; the neutralization is the correct, tested primitive ([[project_csv_formula_injection_primitive]])." }
```
```json
{ "id": "R3", "item": "The visual PDF and Export menu were checked structurally / by handler tests, not by opening the PDF in a viewer or clicking the live menu.",
  "why_skipped": "Live app needs auth + data; the PDF is a valid structure and the handlers are round-trip tested.",
  "confidence_it_does_not_matter": "medium",
  "opened_at": null,
  "outcome": "A founder visual click-through is the remaining human check; flagged, not hidden." }
```

## The un-named reliance (A20/A35)
- I relied on `unpdf`'s text-item coordinates being stable enough that a nearest-anchor assignment maps each
  cell to its date column. The round-trip test against the real unpdf proves it for the tested layout; a future
  unpdf upgrade that changed coordinate rounding is the (low) risk. The test would catch it.
- I relied on the exported cells being single text items (one Tj per cell) so extraction doesn't split them —
  true by construction (one Tm+Tj per cell).

## Constitutional bearing
Delivers a user-specified experience (the named formats + landscape) as the intended result (§1.5.4), with the
round-trip — the actual point of "so it can be imported back" — proven end-to-end (§1.5.1 layer-2), and the
lesson gated by tests (A30) rather than left as prose.
