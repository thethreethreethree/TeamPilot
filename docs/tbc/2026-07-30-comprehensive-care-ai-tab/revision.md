# REVISION MANIFEST — C.A.R.E "AI & Personality" tab (founder 2026-07-30)

Comprehensive settings, pillar 1. Every change to a tracked disposition. Dogfoods `npm run tbc:revision`.

```json
[
  { "id": "R0", "verb": "ADD", "item": "New /dashboard/care/settings/ai page with its own scoped config load + Save.", "disposition": "done", "evidence": "src/app/dashboard/care/settings/ai/page.tsx — loads /api/care/agent/tenant, PATCHes {aiName,aiProductContext,aiTone,aiResponseLength}; tsc 0." },
  { "id": "R1", "verb": "ADD", "item": "AI persona Section (name, product context + upload, tone, length) on the new page.", "disposition": "done", "evidence": "Section reproduced with the same LearningHints + DocUploadButton (8k cap) + the ai_name control-char strip." },
  { "id": "R2", "verb": "MOVE", "item": "JeffGuidancePanel + AdaptiveKnowledgePanel to the new AI tab.", "disposition": "done", "evidence": "rendered on the AI page (self-contained, own endpoints); removed from the Widget page." },
  { "id": "R3", "verb": "ADD", "item": "'AI & Personality' as the FIRST tab in SettingsTabs.", "disposition": "done", "evidence": "SettingsTabs.tsx TABS[0] = { /settings/ai, 'AI & Personality' }." },
  { "id": "R4", "verb": "ADD", "item": "'AI & Personality' as the FIRST card on the settings landing.", "disposition": "done", "evidence": "care/settings/page.tsx CARDS[0] with Sparkles icon + LearningHint." },
  { "id": "R5", "verb": "REMOVE", "item": "AI persona Section + panels from the Widget page (de-duplicate).", "disposition": "done", "evidence": "sed-deleted 627-821; boundary verified (Section close → Business type)." },
  { "id": "R6", "verb": "CHANGE", "item": "Widget Save no longer writes the 4 AI keys (disjoint from the AI page's Save).", "disposition": "done", "evidence": "removed aiProductContext/aiTone/aiResponseLength/aiName from the PATCH body; partial-patch endpoint → no clobber." },
  { "id": "R7", "verb": "REMOVE", "item": "Dead productContextManagedInCode state + setter + 3 unused imports on Widget.", "disposition": "done", "evidence": "state decl + setter + AdaptiveKnowledgePanel/JeffGuidancePanel/DocUploadButton imports removed; tsc 0 (no dangling refs)." },
  { "id": "R8", "verb": "ADD", "item": "TBC artifacts + commit.", "disposition": "done", "evidence": "this build dir; npx tsc --noEmit exit 0." }
]
```

No migration. No item un-dispositioned. Remaining comprehensive pillars (General, Notifications, Data,
Sales-Coach sections) are tracked as separate future builds, not part of this manifest.
