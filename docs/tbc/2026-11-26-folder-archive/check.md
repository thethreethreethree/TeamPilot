# CHECK - Archive a library folder

## Commands

```
node replay0346.mjs → bad kind: refused · after update+delete: archive · owner sees: 1 · another member sees: 0
npm run db:apply → applying 0346_library_folder_archive.sql … ok · ALL 33 invariants hold
npx vitest run library route + folders + library lib → 16 passed; GET archived test → 12 passed (route file)
npm run rls:audit → ✓ (insert/update/delete allowlisted with the writer named)
```

## Findings

### F1 - saving into an archived folder would hide the new item
class: a name lookup that finds an invisible container.
sweep: add restores the folder and returns restored: true (tested).
severity: medium

### F2 - a member could archive a company folder
class: a write that skipped the folder's management rule.
sweep: company folders need a manager (tested 403).
severity: medium

## Final

```
npm run check → exit 0 · Test Files 962 passed | 1 skipped · Tests 6943 passed | 15 skipped
```
