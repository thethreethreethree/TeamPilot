# REVISION MANIFEST — Sales Coach doc upload + objection injection (founder 2026-07-30)

Every atomic change the founder's build instruction requires, to a tracked disposition. Enumerated first
(the discipline that stops a requested item being silently dropped). Dogfoods `npm run tbc:revision`.

```json
[
  { "id": "R1", "verb": "ADD", "item": "Clients can UPLOAD a document whose text fills the Coaching Methodology editor.", "disposition": "done", "evidence": "DocUploadButton on CorpusEditor → /extract → setText; extractText 11/11; PDF proven live." },
  { "id": "R2", "verb": "ADD", "item": "Same upload → fills the Product & brand details editor.", "disposition": "done", "evidence": "DocUploadButton on ProductEditor → setText; same route." },
  { "id": "R3", "verb": "ADD", "item": "Support the listed formats; the un-parseable ones give clear guidance.", "disposition": "done", "evidence": "SUPPORTED allowlist = txt/md/html/rtf/docx/odt/epub/pdf; .doc/.pages/Google-Docs → UnsupportedFormatError 'export as PDF/DOCX/TXT' (founder-confirmed); tests cover each + the rejections." },
  { "id": "R4", "verb": "CHANGE", "item": "Inject mode = fill the draft for review, then Save (not silent overwrite).", "disposition": "done", "evidence": "onExtracted → setText fills the draft; the existing Save flow persists a version on the manager's click (founder-confirmed)." },
  { "id": "R5", "verb": "CHANGE", "item": "Client objection rules (in methodology) drive the LIVE sales coach.", "disposition": "done", "evidence": "extractObjectionGuidance(full methodology) → liveCue grounding → liveCuePrompt objectionBlock; test proves rules past the 600-char truncation survive." },
  { "id": "R6", "verb": "CHANGE", "item": "Same objection rules drive ROLE PLAY.", "disposition": "done", "evidence": "objection block injected into roleplay reviewSystem from corpus?.content (full); the review coaches objection handling by the team's rules — same rules as live coach." }
]
```

**Scope honesty:** OCR for scanned PDFs and glyph-perfect extraction of exotic PDFs are NOT included
(recorded as residual UP-02, not dropped). The objection block adds a bounded per-cue token cost on the
live path (UP-01). No item the founder asked for is un-dispositioned.
