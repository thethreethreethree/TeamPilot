---
tbc_version: 1
trigger: feature
started_at: 2026-08-14T08:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — After-Pitch: show the EXACT failure cause (incl. a 504 timeout), not a raw code / blank

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Cited amendments read in
ThinkerThinker.md this session; CLAUDE.md §§ in-context.

## 2. Why (founder request 2026-08-14, traced against the render)
Founder: "when a failure to generate pitch [happens], can we pinpoint the exact cause, so it shows on the screen
the exact issue?" — and, separately, "http 504 error what does that mean?" Reading the After-Pitch screen:
- The **generation-error** state shows a raw "Couldn't build the summary (HTTP 504)" — the rep sees a code, not
  a cause (a 504 is a serverless-function timeout — the exact failure the founder hit).
- The one-sided (customer-missing) cause IS already named well by `BlankReadRecovery` (+ it drives recovery).
- The **empty-read** case — a two-sided call whose coaching write-up came back empty (NO capture gap, so
  `BlankReadRecovery` stays silent) — shows a blank "Your read" with NO reason.
This is the honesty thesis (§3.4 — never dress a failure as no-data; name the real issue).

## 3. The fix
- `explainAfterPitchError(status, raw)` (pure, tested): maps a generation HTTP failure to a rep-facing cause —
  504/408/timeout → "That took too long to build — your recording is safe, tap Try again"; 502/503 →
  "Transcription is temporarily unavailable (audio saved)"; 403 → private; 429 → too many; else a friendly
  generic hiccup. `generate()` sets a `genError` from it; the error state renders the title + detail (no raw code).
- `diagnoseAfterPitchRead(summary)` (pure, tested): names ONLY the empty-read case (blank narrative, scores
  present, NO capture gap) — returns NULL for a one-sided gap (owned by `BlankReadRecovery`, no duplication) and
  for a healthy read. Rendered as `EmptyReadBanner` at the top of the read.

## 4. Interconnections traced (§1.5)
- `genError` is SEPARATE from the general `error` state (which Start-Next-Door etc. also use) so those keep
  their own messages; only generation failures get the friendly cause. The error branch renders genError first,
  then falls through to the existing `error` branch.
- `diagnoseAfterPitchRead` deliberately returns null for a capture gap → no duplicate cause text with
  BlankReadRecovery (which I READ to confirm it already names the one-sided cause + drives recovery). This is
  the "don't ship a second surface for a cause an existing surface owns" discipline.
- `SummaryLike` is now exported from captureGap (was local) so the classifier reuses the exact shape
  detectCaptureGap validates — one source of truth, no divergent summary type.
- No route/schema change — pure client-side diagnosis over existing state.

## 5. Hypothesis (§1.5.2)
- **H1 — does a 504 now read as a cause, and does an empty two-sided read get named while a one-sided one is
  left to BlankReadRecovery?** Yes: `explainAfterPitchError(504)` → "took too long"; `diagnoseAfterPitchRead`
  returns empty-read for a blank two-sided read and NULL for a one-sided gap — both locked by
  afterPitchDiagnosis.test.ts.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T08:30:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the surface from the record — read the actual render states + BlankReadRecovery before adding a diagnosis, so I don't duplicate an existing cause.", "how_this_build_will_embody_it": "Read the error/blank/read branches + BlankReadRecovery; scoped the new diagnosis to the UNCOVERED cases (generation error + empty-read)." },
  { "id": "§0.1", "read_at": "2026-08-14T08:30:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T08:31:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — the one-sided cause is ALREADY named (BlankReadRecovery); the record shows the gaps are the raw-HTTP error + the empty-read.", "how_this_build_will_embody_it": "Read BlankReadRecovery's copy; only added diagnosis where the screen was silent." },
  { "id": "§1.5", "read_at": "2026-08-14T08:31:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the new diagnosis must not duplicate BlankReadRecovery, must not hijack non-generation errors, must reuse the existing summary type.", "how_this_build_will_embody_it": "Section 4: genError is generation-only, diagnosis returns null for gaps, SummaryLike reused." },
  { "id": "§1.5.1", "read_at": "2026-08-14T08:32:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-4 surface — the feature IS the surface; the rep must read a cause, not a code.", "how_this_build_will_embody_it": "Plain-language title + detail; a 504 reads as 'took too long, recording safe'." },
  { "id": "§1.5.2", "read_at": "2026-08-14T08:32:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: hypothesised the gaps, CONFIRMED by reading BlankReadRecovery (already covers one-sided) before building.", "how_this_build_will_embody_it": "Scoped OUT the one-sided case after reading it was covered; H1 gated by the test." },
  { "id": "§3.4", "read_at": "2026-08-14T08:33:00Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty — a raw HTTP code or a silent blank read dresses a failure as no-data; the surface must name the real issue.", "how_this_build_will_embody_it": "Every failure state now states its cause in plain language; the empty-read is named, not shown blank." },
  { "id": "§6", "read_at": "2026-08-14T08:33:30Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (BlankReadRecovery duplication, non-generation errors, the summary type).", "how_this_build_will_embody_it": "All enumerated in Section 4." },
  { "id": "A19", "read_at": "2026-08-14T08:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before adding a surface.", "how_this_build_will_embody_it": "Read the render + BlankReadRecovery + captureGap before writing the diagnosis." },
  { "id": "A22", "read_at": "2026-08-14T08:34:30Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T08:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "Sweep the class — every After-Pitch failure state should name its cause, not just the one the founder saw.", "how_this_build_will_embody_it": "Swept the generation-error states (504/502/403/429/generic) + the empty-read; the one-sided + fully-blank states were already named." },
  { "id": "A30", "read_at": "2026-08-14T08:35:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "afterPitchDiagnosis.test.ts locks the error-cause mapping (504→took too long) + empty-read-vs-one-sided classification." },
  { "id": "A38", "read_at": "2026-08-14T08:36:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0." }
]
```
