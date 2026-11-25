# CHECK - Team CSV changes roles too

## Commands

```
npx vitest run src/lib/team src/app/api/team → 82 passed (set-role's 7 unchanged; new: setMemberRole ×3, plan role change, import preview/apply)
```

## Findings

### F1 - a bulk demotion could leave the company with no admin
class: a safety check that ran per request, now run per row.
sweep: the only other role writer is /api/team/set-role, which now uses the same function.
severity: high (prevented by design)

## Final

```
npm run check → exit 0 · Test Files 936 passed | 1 skipped · Tests 6814 passed | 15 skipped
```
