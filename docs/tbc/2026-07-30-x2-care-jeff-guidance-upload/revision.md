# REVISION MANIFEST — C.A.R.E doc upload + Jeff guidance (founder 2026-07-30)

Every requested change to a tracked disposition (the J-items from the resume plan). Dogfoods
`npm run tbc:revision`.

```json
[
  { "id": "J0", "verb": "ADD", "item": "New guidance field — migration + config + type.", "disposition": "done", "evidence": "0202 migration; config.ts type+mapper; widgetSafe test confirms no widget leak." },
  { "id": "J1", "verb": "CHANGE", "item": "extractText per-caller cap (maxChars).", "disposition": "done", "evidence": "extractText(buf,name,{maxChars}); epub threaded; backward-compatible; tsc 0." },
  { "id": "J2", "verb": "CHANGE", "item": "Jeff prompt injects the guidance block + the real callers pass it.", "disposition": "done", "evidence": "buildCareSystemPrompt block (scoped within core rules); widget + email callers pass tenant?.aiAssistanceGuidance; careGuidancePrompt test 3/3." },
  { "id": "J3", "verb": "ADD", "item": "Save + serve guidance (admin, A34-guarded).", "disposition": "done", "evidence": "tenant route zod + patch + generalized deferred-column guard; GET returns it via select(*)." },
  { "id": "J4", "verb": "ADD", "item": "Shared C.A.R.E extract route + invariant allowlist.", "disposition": "done", "evidence": "/api/care/agent/acms/extract (admin, 4MB, per-field cap); route test 4/4; UPLOAD_VALIDATE_ALLOWLIST entry." },
  { "id": "J5", "verb": "CHANGE", "item": "DocUploadButton endpoint + maxChars props (reusable).", "disposition": "done", "evidence": "props added, defaults preserve sales-coach behavior; sends maxChars." },
  { "id": "J6", "verb": "ADD", "item": "Guidance editor UI + upload.", "disposition": "done", "evidence": "JeffGuidancePanel.tsx rendered in care/settings/widget; DocUploadButton (care route, 8k)." },
  { "id": "J7", "verb": "CHANGE", "item": "Adaptive Knowledge multi-format upload.", "disposition": "done", "evidence": "AdaptiveKnowledgePanel: broadened accept, doc formats route through the care extract route (200k), copy updated." },
  { "id": "J8", "verb": "ADD", "item": "Product-context upload.", "disposition": "done", "evidence": "DocUploadButton on the product-context editor (8k), hidden when code-managed (ELOSTATE)." },
  { "id": "J9", "verb": "ADD", "item": "Tests + Jeff product knowledge + TBC + commit.", "disposition": "done", "evidence": "2 test files (7 assertions); elostateProductKnowledge.ts updated; this TBC dir; npm run check exit 0." }
]
```

Migration 0202 NOT applied (A34-guarded; founder db:apply). No item un-dispositioned.
