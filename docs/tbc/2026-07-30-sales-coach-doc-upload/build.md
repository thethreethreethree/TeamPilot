# BUILD — Sales Coach doc upload + objection injection

Files: `src/lib/documents/extractText.ts` (+ test), `src/app/api/coach/sales-session/extract/route.ts`,
`src/components/sales-coach/DocUploadButton.tsx`, `src/app/dashboard/sales-coach/settings/page.tsx`
(wire both editors), `src/lib/coach/v5/objectionGuidance.ts` (+ test),
`src/lib/coach/v5/liveCue.ts` + `liveCuePrompt.ts` (live-cue objection block),
`src/app/api/coach/sales-session/roleplay/route.ts` (review objection block), `package.json` (unpdf).

### Multi-format text extraction (extractText)

- write-path: **exists** — `extractText(buffer, filename)` decodes .txt/.md, strips .html/.rtf, unzips
  .docx/.odt/.epub via jszip, parses .pdf via unpdf; unsupported (.doc/.pages/unknown) throws
  `UnsupportedFormatError`; empty result throws `EmptyExtractionError` (A27 — never a silent ""). human_can_set: n/a (pure lib).
- read-path: **exists** — returns `{ text, format }`, capped at MAX_EXTRACTED_CHARS. human_can_see: the text lands in the editor.
- reachability: **BUILT** — extractText test 11/11 (every native+zip format + rejections + empty); PDF proven live (unpdf pulled 7,248 chars from a real repo PDF, pasted in check.md).

### Upload endpoint (/api/coach/sales-session/extract)

- write-path: **exists** — POST multipart; manager-gated (isSalesCoachManager, same as the editors, A28); 15MB cap; returns extracted `{text, format, chars, truncated}`; 415/422/413/400 with friendly messages, generic 500 on a parser throw (CWE-209). human_can_set: a manager uploading a file.
- read-path: **exists** — the JSON `text` is handed to the editor by DocUploadButton. human_can_see: **yes**.
- reachability: **BUILT** — nodejs runtime + maxDuration:30 (jszip/unpdf need Node; PDF parse is slow); tsc exit 0.

### Upload UI on both editors (DocUploadButton)

- write-path: **exists** — a file input posts to /extract; on success `onExtracted(text)` calls the editor's `setText`, filling the draft (the founder's "fill the draft for review" choice). human_can_set: **yes** — "Upload a file" button on the Coaching methodology AND Product & brand editors.
- read-path: **exists** — the extracted text renders in the textarea; the existing dirty-check enables Save; the existing POST /corpus|/product persists it → getCurrentSalesCorpus → the prompts. human_can_see: **yes** — the whole seam upload→edit→save→prompt.
- reachability: **BUILT** — wired into both CorpusEditor and ProductEditor; toast surfaces errors + a truncation notice; non-destructive (draft only, saved version untouched until Save).

### Objection rules into BOTH live coach + role play (objectionGuidance)

- write-path: **exists** — `extractObjectionGuidance(fullMethodology, n)` pulls the objection-relevant blocks from the FULL methodology (before the 600/4000-char truncation) → injected as a dedicated block in the live-cue system prompt (liveCue.ts grounding → liveCuePrompt.ts objectionBlock) AND the role-play REVIEW prompt (roleplay reviewSystem). human_can_set: a manager writing objection rules anywhere in the methodology.
- read-path: **exists** — the objection block reaches both LLM prompts un-truncated, so the agent's rejection coaching follows the client's rules in both modes. human_can_see: indirectly — the cue/review reflect the client's objection rules.
- reachability: **BUILT** — objectionGuidance test 4/4 incl. the "survives past the 600-char truncation" case; corpus?.content (full) confirmed passed to reviewSystem (route:195); liveCue computes it from the full methodology.

## Verification (A38)

`npm run check` output + exit code in closure.md's verification record.
