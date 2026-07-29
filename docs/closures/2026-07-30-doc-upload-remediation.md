# Session-Reads closure — doc-upload audit remediation (2026-07-30)

Full session-read manifest (13 entries, this-session read_at) in
`docs/tbc/2026-07-30-x-doc-upload-remediation/think.md`, validated by verify-manifest.mjs.
Clauses re-read: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md A19, A22, A26, A27, A30, A31,
A33, A38. Un-named reliance (A35): A28 (the 100k field-cap precedent F5 aligns to) + A29 (sweep discipline)
— opened in closure §8.

A formal two-pass audit of the doc-upload build (da4868a2) found 5 findings. FIXED: F5 (extraction cap
500k→100k so a large upload doesn't fill an un-saveable editor — a §1.5.1 layer-3 dead-end), F3 (route
byte cap 15MB→4MB under Vercel's serverless body limit + client pre-check, A27), F2 (decode `&amp;` last
to stop entity double-decode). DECLINED with the hole named (A33): F1 (zip-bomb — no clean jszip gate,
bounded by manager-gate + platform) + F4 (binary-as-text — manager-review is the control). Gates added for
F2 + F5. `npm run check` exits 0.
