# BUILD — C.A.R.E doc upload + Jeff assistance-guidance field

Files: `0202_care_assistance_guidance.sql`, `src/lib/care/config.ts` (+widgetSafe test),
`src/lib/care/prompt.ts` (block + param), `src/app/api/care/conversations/[id]/messages/route.ts` +
`inbound/email/route.ts` (callers), `src/app/api/care/agent/tenant/route.ts` (save + A34 guard),
`src/app/api/care/agent/acms/extract/route.ts` (+test), `src/components/sales-coach/DocUploadButton.tsx`
(reusable), `src/components/care/JeffGuidancePanel.tsx`, `AdaptiveKnowledgePanel.tsx`,
`care/settings/widget/page.tsx` (render + product upload), `src/lib/documents/extractText.ts` (maxChars),
`scripts/invariant-audit.mjs` (allowlist), `elostateProductKnowledge.ts` (Jeff knowledge),
`src/lib/care/__tests__/careGuidancePrompt.test.ts`.

### New Jeff customer-assistance guidance field (reaches his replies)

- write-path: **exists** — JeffGuidancePanel → PATCH /api/care/agent/tenant `{aiAssistanceGuidance}` →
  `care_tenant_config.ai_assistance_guidance` (admin-gated). human_can_set: **yes** — the guidance editor.
- read-path: **exists** — config mapper → the widget + email callers pass `tenant?.aiAssistanceGuidance`
  → `buildCareSystemPrompt` injects the "HOW TO ASSIST" block into Jeff's system prompt for every reply.
  human_can_see: **yes** — Jeff's behavior follows it (prompt test 3/3).
- reachability: **BUILT** — not dead surface; the block is scoped within Jeff's core honesty rules.

### Multi-format upload on all three C.A.R.E surfaces

- write-path: **exists** — DocUploadButton (now `endpoint`+`maxChars` props) posts to
  `/api/care/agent/acms/extract` (admin-gated, 4MB, per-field cap) → returns text → fills the draft on:
  the guidance editor (8k), the Adaptive Knowledge panel (200k, non-text formats), the product-context
  editor (8k). human_can_set: **yes** — an "Upload a file" control on each.
- read-path: **exists** — extracted text renders in each editor → the existing save persists it → the
  respective read path (Jeff's prompt / knowledge). human_can_see: **yes**.
- reachability: **BUILT** — care extract route test 4/4 (401/403/415/200); allowlisted in invariant-audit.

### A34-safe migration coupling

- write-path: **exists** — the config-save guard drops the ordered deferrable columns (business_type,
  ai_assistance_guidance) on a missing-column error + retries, so OTHER settings still save; returns
  `assistanceGuidanceDeferred` so the editor tells the admin migration 0202 is pending.
- read-path: **exists** — config `select("*")` omits the absent column → mapper → null → no prompt block.
  human_can_see: no breakage pre-migration.
- reachability: **BUILT** — isMissingColumnError(err, "ai_assistance_guidance") names the exact column.

## Verification (A38)

`npm run check` output + exit code in closure.md's verification record.
