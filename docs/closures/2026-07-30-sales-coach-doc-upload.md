# Session-Reads closure — Sales Coach doc upload + objection injection (2026-07-30)

Full session-read manifest (14 entries, this-session read_at) in
`docs/tbc/2026-07-30-sales-coach-doc-upload/think.md`, validated by verify-manifest.mjs.
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md
A19, A22, A26, A27, A28, A30, A31, A33, A38.

Founder urgent build. Clients upload documents (.txt/.md/.html/.rtf/.docx/.odt/.epub/.pdf; .doc/.pages/
Google-Docs → clear "export as PDF/DOCX/TXT" guidance, founder-confirmed) whose text fills the Coaching
Methodology and Product & brand editors for review, then Save via the existing flow. The objection rules
in the methodology now reliably drive BOTH the live sales coach and role play, via a bounded
objection-guidance block pulled from the FULL methodology (surviving the 600/4000-char truncations that
were dropping them). New: extractText + unpdf (PDF), an extract route, DocUploadButton, objectionGuidance.
No migration. `npm run check` exits 0.
