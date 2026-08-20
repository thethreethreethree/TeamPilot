# Closure — real-file schedule PDF import (2026-08-21)

## What triggered it
The founder's own schedules — `HK.pdf` and `HUB SCHED.pdf` — failed to import all day. First with "No
staff-by-date grid was found", then, after a partial fix, with "Couldn't build the preview." Two prior "fixed"
reports this session were verified only against **synthetic** PDFs and `frendz.pdf` (a different parser), so they
were green while the real files stayed broken — the §5 confident-well-formed-failure. The turning point was the
founder sending the actual file paths; the real causes were then findable in minutes.
Lesson recorded: `memory/feedback_verify_against_real_artifact_not_synthetic.md`.

## Root causes (found only by diagnosing the real bytes) and fixes
1. **Specific parser threw a non-Empty error.** `extractStaffDateGridFromPdf` raised a pdf.js
   `DataCloneError: Cannot transfer object` (not `EmptyExtractionError`), so the working generic fallback was
   skipped → dead 422. **+** `unpdf`'s loopback worker **breaks on a 2nd call in one process**, so re-extracting
   in the fallback would fail too. → Route now extracts text **ONCE** and runs both the specific parser and the
   generic fallback over the **same pages**; a parser throw is caught and drops to the fallback. (`b8fce1b3`)
2. **No year → dates unresolvable.** Headers carry day numbers (`16..31`) + a month (`AUGUST` / `AUG.`) but no
   year, so the LLM correctly refused to guess and the preview couldn't build. → `importDates.ts`
   `resolveGridDates` resolves deterministically: month from the file, year nearest today; handles bare `16` and
   `AUG. 16`; leaves `TOTAL` blank; empty ⇒ fall back to Analyze. (`9b4fdd36`)
3. **HUB SCHED's layout.** A split two-row header (`AUG.` row + day-number row), `PM SHIFT` / `SKY BAR` section
   labels, and a `SKY-BAR` code wrapped across two lines. → `pdfGridToCsv` merges **nameless** rows into the row
   above (reuniting `AUG.`+`16` → `AUG. 16` and wrapped codes), drops **named-no-data** label rows, and rejoins a
   dash-terminated wrap without a space (`SKY-`+`BAR` → `SKY-BAR`). (`9b4fdd36`, `e0693fd3`)
4. **Numeric codes guessed wrong by the LLM.** `7-4` came in ending `4:57 PM`. → `importTime.inferNumericShift`
   (start 6–11 AM / 1–5 PM / 12 noon; end = the AM/PM reading giving a 2–16h shift, preferring PM), folded into
   `autoTimeRangeCodeMap`, which the client already prefers over the LLM. (`105174e8`)
5. **Format inconsistency.** The date + code resolution was wired only into the PDF fallback; DOCX/XLSX still
   returned empty dates. → The docx/xlsx branch now resolves dates + codes identically. (`43cc8a39`)
6. **Analyze/paste path still blank (founder re-test).** The deterministic resolver was in the file-upload route
   only; the paste-CSV → **Analyze** path (`/upload/propose`) still took dates from the LLM alone → all blank,
   and the preview's `headerDates.min(1)` then failed with "Couldn't build the preview." → propose now runs
   `resolveGridDates` first, prefers it over the LLM per-column, and returns dates even if the LLM (codes) fails.
   Both import paths resolve dates identically. (`822c5438`)

Operator doc brought current: `docs/SCHEDULE-EXPORT.md` (`010f387c`).

**Preview link verified:** the preview route requires all `headerDates` ISO, but the client filters empties
before sending, so HK's trailing `TOTAL` blank is dropped and the 16 real dates align to the day columns →
128 shifts → preview builds. Latent (unfixed, no real case): the client's empty-filter would misalign a
*mid-grid* blank column; HK/HUB have `TOTAL` last, so safe.

## Verified against reality
Canonical command:
```
$ npm run check
Tests  3428 passed | 15 skipped (3443)
exit 0
```
End-to-end on the founder's actual bytes (throwaway local tests — real PDFs aren't in the repo, so removed after):
```
frendz.pdf : 6 staff  × 31 dates (specific parser, unchanged)
HK.pdf     : 12 staff × 16 dates → 128 shifts + 48 off  (only G-Y to map by hand)
HUB SCHED  : 13 staff × 16 dates → 134 shifts + 63 off  (only SKY-BAR to map by hand)
```
Regression-checked: frendz.pdf still parses through the new extract-once flow.

## Residual (ranked, none blocking)
- **R1 — founder-gated:** remember `G-Y` / `SKY-BAR` (and any org code) → time per company, so they pre-fill on
  future imports. Needs the founder's greenlight + a storage-shape decision (event vs. companies column, §3.1).
- **R2 — deferred by discipline:** cross-month day-number rollover (`…30, 31, 1, 2…` kept in one month). A real
  gap, but NOT built — no real cross-month file to verify against, and building for an imagined case is the exact
  trap this session's lesson is about. Fix when a real file exhibits it.
- **R3 — human:** the founder's on-screen re-test of both files to Import is the final confirmation (my tests on
  their bytes are strong evidence, not the founder's confirmation — `feedback_verification_discipline`).

## The un-named reliance
The generic fallback assumes `unpdf`'s positioned text is stable enough that x-clustering recovers columns; the
real-file tests prove it for these layouts, and a `unpdf` upgrade changing coordinate rounding is the (low) risk
the committed synthetic tests would catch.
