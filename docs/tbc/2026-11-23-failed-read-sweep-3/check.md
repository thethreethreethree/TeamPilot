# CHECK - Third sweep: failed reads shown as "none"

## Commands

```
grep (src/components, src/app): if (!r.ok) return … → 1 (WeeklyRoutine: maps to "Couldn't check", intended) · .catch(() => null) → 158 · .catch(() => []) → 1 · .catch(() => ({})) → 73 (json-body parse fallbacks)
read in context: ~40 fetch(...).catch(() => null) sites — team, training, coach-assessment, sessions, analytics, dashboard, care, after-pitch, ProtectionSettings ×3, Vocabulary, SessionTranscript, TrackerAdoption, FollowThrough, UnscoredBacklog, TopicGroups, RepRoutine: explicit failed states already, or label/decoration only
found: TeamPasswordsDialog, AddAgentDialog (failure → "create one first"), SessionDetailView (review → paid generate offered; why → second permanent read invited; summary → card silently hidden)
npx vitest run PasswordDialogs.failedRead.render → 2 passed; old dialogs restored → 2 failed; fix back → 2 passed
npx vitest run SessionDetailView.failedParts.render → 1 passed; old page restored → 1 failed; fix back → 1 passed
npx vitest run noFailedReadAsEmpty → 6 passed; with the old dialogs → else-form guard lists both files
```

## Findings

### F1 - team password dialogs: a failed read read as "no team password yet — create one"
class: failed read presented as empty, inviting a duplicate.
sweep: the else form (`else set…([])` after `.ok`) across src/components and src/app → these 2 only.
severity: medium

### F2 - a call's page: a failed review read offered a paid "Generate growth review"; a failed "why" read reopened the append-only composer
class: failed read presented as none, inviting a costly or permanent action.
sweep: SessionDetailView's four parallel reads; the session read already failed loudly; review/summary/why now do too.
severity: high (paid LLM run; duplicate immutable event)

## Final

```
npm run check → first: ✗ tbc:manifest (§2.2 reason too short) → given a real reason → exit 0 · Test Files 898 passed | 1 skipped · Tests 6626 passed | 15 skipped
```
