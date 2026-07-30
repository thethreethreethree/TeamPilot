# REVISION MANIFEST — C.A.R.E "General" tab (founder 2026-07-30)

Comprehensive settings, pillar 2. Dogfoods `npm run tbc:revision`.

```json
[
  { "id": "R0", "verb": "ADD", "item": "New /dashboard/care/settings/general page (Learning + Experience mode + jump-map).", "disposition": "done", "evidence": "src/app/dashboard/care/settings/general/page.tsx; tsc 0." },
  { "id": "R1", "verb": "ADD", "item": "'General' as the FIRST tab in SettingsTabs.", "disposition": "done", "evidence": "SettingsTabs.tsx TABS[0] = { /settings/general, 'General' }." },
  { "id": "R2", "verb": "ADD", "item": "'General' as the FIRST landing card.", "disposition": "done", "evidence": "care/settings/page.tsx CARDS[0] with SlidersHorizontal icon + LearningHint." },
  { "id": "R3", "verb": "MOVE", "item": "Experience Mode from the settings landing to the General tab.", "disposition": "done", "evidence": "landing ExperienceModePanel block + import removed; rendered on General; grep confirms no landing ref remains." },
  { "id": "R4", "verb": "SKIP", "item": "Sales-Coach General tab.", "disposition": "done", "evidence": "grep found LearningModePanel+ExperienceModePanel already on the Sales-Coach Account tab (lines 156/159) — a redundant tab would be manufactured work (A24)." },
  { "id": "R5", "verb": "ADD", "item": "TBC artifacts + commit.", "disposition": "done", "evidence": "this build dir; npx tsc --noEmit exit 0." }
]
```

No migration. No item un-dispositioned. Backend-heavy pillars (Notifications, Data & Privacy, Grading)
tracked as separate future builds.
