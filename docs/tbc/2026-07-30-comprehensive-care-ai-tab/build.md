# BUILD — C.A.R.E "AI & Personality" tab (comprehensive settings, pillar 1)

Files:
- `src/app/dashboard/care/settings/ai/page.tsx` (NEW) — the AI & Personality page: own tenant-config load
  + a Save scoped to {aiName, aiProductContext, aiTone, aiResponseLength}; renders the persona Section
  (name, product context + upload, tone, length) + `<JeffGuidancePanel/>` + `<AdaptiveKnowledgePanel/>`.
- `src/components/care/SettingsTabs.tsx` — added `{ /settings/ai, "AI & Personality" }` as the FIRST tab.
- `src/app/dashboard/care/settings/page.tsx` — added the "AI & Personality" landing card as the FIRST card.
- `src/app/dashboard/care/settings/widget/page.tsx` — REMOVED: the AI personality Section, both panels,
  the 4 AI keys from the Save body, the `productContextManagedInCode` state + its setter, and the 3 now-
  unused imports (AdaptiveKnowledgePanel, JeffGuidancePanel, DocUploadButton).

### Discoverable AI-persona surface (was buried at the bottom of Widget)

- write-path: **exists** — the AI page loads `/api/care/agent/tenant`, edits name/product/tone/length,
  and PATCHes those 4 fields only. human_can_set: **yes** — first tab + first landing card.
- read-path: **exists, unchanged** — the same tenant columns feed Jeff's system prompt (buildCareSystemPrompt).
  human_can_see: **yes** — Jeff's behavior reflects the saved persona.
- reachability: **BUILT** — SettingsTabs + landing card link the page; it renders + saves end-to-end.

### Disjoint Saves (no clobber — the one real risk)

- The Widget Save body no longer contains aiProductContext/aiTone/aiResponseLength/aiName; the AI page
  PATCHes exactly those 4. `/api/care/agent/tenant` is a partial patch → the two pages write disjoint
  column sets → saving one never reverts the other. reachability: **BUILT** — verified by typecheck (no
  dangling references to the removed fields/state/imports on the Widget page).

## Verification (A38)

`npx tsc --noEmit -p tsconfig.json` → exit 0 (recorded in closure.md).
