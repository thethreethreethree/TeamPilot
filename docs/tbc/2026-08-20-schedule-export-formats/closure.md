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

---

## Addendum — 2026-08-21 continuation (import robustness + colour + verification-against-reality)

Work that landed after the closure above, in response to founder reports ("the system still fails to import
this PDF", "it's too plain / needs colours", "the page is broken/messy"):

**Shipped (all live, HEAD `0c734ed4`):**
- **Generic foreign-PDF import fallback** (`pdfGridToCsv`, commit `8c81b365`) — a valid staff×date PDF the
  frendz/ISO readers don't recognize (e.g. `AUG 16` date-label headers) now clusters positioned text into
  columns/rows → CSV → the same Analyze/confirm flow docx/xlsx use. Both upload paths route through it.
- **Multi-page corruption fix** (`5a53147c`) — the fallback flattened all pages and grouped rows by ABSOLUTE y;
  PDF y resets per page, so same-height rows on different pages merged. Now columns cluster globally, rows group
  per page. Failing-first multi-page test added, then fixed. (This retires the R1-class risk for the generic
  path — pages no longer collide.)
- **One week per page** (`422d6c2e`) — colour PDF + Print render each week to its own landscape page (no
  mid-week break); `exportEmptyMsg` (`4b254389`) gives accurate no-shifts vs too-large feedback.
- **Colour export + custom name** — verified live (see below).

**Verified against reality (not just handler tests — this addresses residual R3):**
- **Real `frendz.pdf`** through the current code after the `extractPdfPages` refactor: `staff=6 dates=31
  warnings=0 shifts=153 off=33 unknown=[]`. The mixed double/single-dash quirk (`1--10` vs `6-3`) is absorbed by
  `normalizeCode`; the extract route dedupes codes so the manager maps each once. No regression, no code bug (an
  early "0 shifts" reading was a throwaway-harness error — codeMap values must be `{start,end}`, diagnosed not
  assumed). Temp tests were local-only (depend on a scratchpad file) and removed, not committed.
- **Foreign fallback E2E through real `unpdf`** (`writePdf.test.ts`) + jitter/multi-word-name guards
  (`pdfIsoGrid.test.ts`).
- **Colour export rendered** from a faithful copy of the real `renderCanvas` + `shiftColors` palette and sent to
  the founder as a PNG for eye-judgement — R3's "open it in a viewer" check, now done for the colour graphic.
- **Legibility is measured + locked**: every band's shift-time text on its tint passes WCAG AA (worst 6.37:1);
  a contrast guard in `shiftColors.test.ts` (`0c734ed4`) fails if a future colour tweak drops below 4.5:1.
  Colour is redundant — every cell also prints the time as text.

**Still the founder's (external / human):** apply migration `0234` (custom-name WRITE persists; READ degrades to
company name until then, fail-loud notice); the founder's eye-check on the colour sample; the founder's import
re-test with their own file.
