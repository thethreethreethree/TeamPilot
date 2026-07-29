---
tbc_version: 1
trigger: feat
started_at: 2026-07-30T00:10:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 4
---

# THINK — Sales Coach doc upload → Coaching Methodology + Product; objection rules into both modes

Founder urgent build (2026-07-30). Clients upload documents; their text fills the Coaching Methodology
and Product & brand editors. The objection-handling rules in the methodology must reach BOTH the live
sales coach and role play. Three decisions confirmed by the founder (see section 4).

## 1. Document integrity (§0.1) — DONE, MATCH

`sha256sum` + `wc -l` of CLAUDE.md (e08874…, 429) and ThinkerThinker.md (0428…, 1039) MATCH
DOC_MANIFEST.json exactly. Proceed.

## 2. Session-read manifest (A22, A35 — minimum set unconditional)

```json
[
  { "id": "§0",     "read_at": "2026-07-30T00:15:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding precedes solving — I grounded the build by reading the settings surface, both save endpoints, and the live-cue/roleplay injection points BEFORE proposing, and found the real Part-2 gap (truncation) from the code, not a theory.", "how_this_build_will_embody_it": "Sections 4/5 rest on the read code (liveCue 600-char slice, roleplay 4000)." },
  { "id": "§0.1",   "read_at": "2026-07-30T00:15:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the working tree, verified + read this session.", "how_this_build_will_embody_it": "Integrity check pasted; this manifest carries this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-30T00:15:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — an upload that extracts text (layer 2) but doesn't leave the client able to review + save (layer 3) fails, however clean the parser.", "how_this_build_will_embody_it": "Section 5 walks the layers; upload FILLS THE DRAFT then the existing Save flow continues (continuity)." },
  { "id": "§1.5.2", "read_at": "2026-07-30T00:15:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Think then search — I hypothesised how extraction + the objection injection could fail BEFORE grepping (section 3).", "how_this_build_will_embody_it": "Hypotheses precede the code; each names its confirming search." },
  { "id": "§6",     "read_at": "2026-07-30T00:15:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — is the constraint (some formats un-parseable serverlessly) real or incidental? Real → respect it, find a better destination (clear export guidance), do not pick the lock with a fragile parser.", "how_this_build_will_embody_it": "Un-parseable formats get an honest 'export as PDF/DOCX/TXT' message, not a broken parser (founder-confirmed)." },
  { "id": "A19",    "read_at": "2026-07-30T00:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree.", "how_this_build_will_embody_it": "This-session reads recorded." },
  { "id": "A22",    "read_at": "2026-07-30T00:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "Every cited id resolves to a this-session entry; commit uses Session-Reads Form A." },
  { "id": "A26",    "read_at": "2026-07-30T00:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-715", "why_it_governs": "Two classes here: (a) extraction failure per format (a parser that throws on one format must not take down the others), (b) truncation silently dropping the objection rules — one instance (live-cue 600) implies the sibling (roleplay 4000).", "how_this_build_will_embody_it": "Per-format extraction is isolated + the truncation fix is applied to BOTH injection sites, swept in check.md." },
  { "id": "A27",    "read_at": "2026-07-30T00:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "720-734", "why_it_governs": "The upload button PROMISES 'your document's content is injected' — the write path (extraction) must ENFORCE that: deliver real text or fail honestly, never silently fill the field with empty/garbage.", "how_this_build_will_embody_it": "Extraction returns an explicit error on empty/failed parse; the UI surfaces it and does NOT overwrite the draft with nothing." },
  { "id": "A28",    "read_at": "2026-07-30T00:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "Precedent decides shape: the corpus/product editors + their POST endpoints already exist; roleplay + live-cue ALREADY inject methodology. I extend these, not reinvent — the upload fills the SAME textarea that already saves.", "how_this_build_will_embody_it": "Upload → setText → existing POST /corpus|/product; Part 2 raises the EXISTING injection budgets rather than adding a new path." },
  { "id": "A31",    "read_at": "2026-07-30T00:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-817", "why_it_governs": "Reachability across the seam: upload (write) → extract → fill draft → Save → getCurrentSalesCorpus → prompt (read). Every hop asserted, or the feature is schema-correct but non-functional.", "how_this_build_will_embody_it": "build.md asserts write-path AND read-path for the upload and for the objection injection." },
  { "id": "A30",    "read_at": "2026-07-30T00:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — the extraction contract + format-support boundary are unit-pinned so a regression that drops a format fails a test.", "how_this_build_will_embody_it": "extractText has a test per supported format + the unsupported-format rejection." },
  { "id": "A33",    "read_at": "2026-07-30T00:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "850-869", "why_it_governs": "A gate must be precise — the support boundary is an explicit allowlist of extensions/MIME, not a fuzzy sniff; unsupported → an honest 415, not a guess.", "how_this_build_will_embody_it": "A SUPPORTED map is the single source of truth; anything else is rejected by construction." },
  { "id": "A38",    "read_at": "2026-07-30T00:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a command — closes after npm run check.", "how_this_build_will_embody_it": "closure.md pastes the canonical command output + exit 0." }
]
```

## 3. Hypotheses (before search — §1.5.2)

```json
[
  { "id": "H1", "claim": "The .docx/.odt/.epub formats can be extracted WITHOUT a new dependency because jszip is already installed (they are ZIP containers of XML/XHTML).", "confidence": "high", "test": "grep package.json for a zip lib.", "outcome": "CONFIRMED — jszip ^3.10.1 + fflate ^0.8.3 present. Only .pdf needs a new lib." },
  { "id": "H2", "claim": "The objection rules do NOT reliably reach the prompts today because the methodology is truncated small before injection.", "confidence": "medium", "test": "read liveCue + roleplay injection.", "outcome": "CONFIRMED — live-cue slices methodology to 600 chars; roleplay to 4000. Objection rules past those cut off. Part 2 = raise budgets so they survive." },
  { "id": "H3", "claim": "No new migration is needed — the upload reuses the existing corpus/product store + save endpoints.", "confidence": "high", "test": "read the editors' save calls + getCurrentSalesCorpus.", "outcome": "CONFIRMED — /api/coach/sales-session/corpus|product already persist; upload only fills the textarea that posts to them." },
  { "id": "H4", "claim": "A single malformed/huge upload must not crash the endpoint or bleed one format's parser failure into another.", "confidence": "high", "test": "extraction wrapped per-format with a size cap + honest error; unit test the failure paths.", "outcome": "TO VERIFY in build — extractText returns a typed result; the route caps size + returns 4xx on failure." }
]
```

## 4. Spec fidelity — restated + confirmed decisions

**Restated:** (1) On the Sales Coach → Coaching tab, let a manager UPLOAD a document whose extracted text
FILLS the Coaching Methodology and Product & brand editors (they then review + Save via the existing
flow). (2) The client's objection-handling rules (written in the methodology) must drive the AI's
objection behavior in BOTH the live sales coach and role play.

**Confirmed with the founder (not guessed):**
- Formats: robustly support .txt/.md/.html/.rtf/.docx/.odt/.epub/.pdf(text-layer); .doc/.pages/Google
  Docs → honest "export as PDF/DOCX/TXT and re-upload" (they are not reliably parseable serverlessly —
  a real constraint respected, not lock-picked, §6).
- Inject mode: fill the draft for review, then the existing Save (non-destructive to versions).
- Objection element: rules live IN the methodology; wire the methodology (incl. objection rules) into
  BOTH modes — the concrete work is the truncation fix so they survive.

**No framework conflict.** The upload adds no new prompt-trust boundary (the methodology is already
client-authored text that enters the prompts). Raising the live-cue methodology budget is a real
latency/token trade-off on real-time cues — flagged in the report, bounded (not unlimited).

## 5. Four-layer pre-walk (§1.5.1)

- **1 structure:** one pure `extractText(buffer, filename, mime)` module + one multipart route; the UI adds
  an upload button to the two existing editors; Part 2 edits two existing injection budgets. No schema.
- **2 effectivity:** a real .docx/.pdf/.txt upload yields the document's text in the editor; the client's
  objection rules appear in both prompts (verified by reading the assembled prompt inputs).
- **3 composition:** upload leaves the client in the existing review→Save flow (continuity), not a dead
  end. Unsupported formats leave them with a clear next action (export + re-upload).
- **4 surface:** an unobtrusive "Upload a file" control on each editor, matching the existing card styling,
  with the supported-formats list + the cap shown up front (up-front honesty about the real state).

**verdict: SHIPPABLE.**
