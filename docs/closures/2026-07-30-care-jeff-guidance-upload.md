# Session-Reads closure — C.A.R.E doc upload + Jeff guidance (2026-07-30)

Full session-read manifest (13 entries, this-session read_at) in
`docs/tbc/2026-07-30-x2-care-jeff-guidance-upload/think.md`, validated by verify-manifest.mjs.
Clauses re-read: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md A19, A22, A27, A28, A30, A31,
A34, A38.

Founder (2 images): add multi-format upload to C.A.R.E + a NEW Jeff "customer-assistance guidance" field
(methodology-equivalent, wired into Jeff's replies). Confirmed via AskUserQuestion. Built: migration 0202
(care_tenant_config.ai_assistance_guidance), config + prompt wiring (block scoped within Jeff's core
honesty rules; widget + email callers pass it), the tenant save (A34-guarded), a shared admin-gated
care extract route, DocUploadButton made reusable (endpoint+maxChars), a guidance editor panel, and
multi-format upload on all THREE surfaces (Adaptive Knowledge, guidance, product-context). Reuses the
sales-coach extractor (A28). Migration NOT applied (A34-guarded → no-op until db:apply). `npm run check`
exits 0 (1654 tests). Jeff product knowledge updated.
