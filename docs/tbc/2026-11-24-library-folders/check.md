# CHECK - Save a call to a folder you name, with a note; Listen later

## Commands

```
npx vitest run library routes (incl. folders.test) + RemoteCallPanel renders → 8 passed, 3 passed
```

## Findings

### F1 - free-typed folder names would split into near-duplicates
class: identity by user-typed text.
sweep: the only by-name lookup is the library route's; names are trimmed and spaces collapsed; existing names suggested.
severity: low

## Final

```
npm run check → first: ✗ noFailedReadAsEmpty (the folder-suggestion read) → counted as a suggestion read like the share/mention names → exit 0 · Test Files 931 passed | 1 skipped · Tests 6791 passed | 15 skipped
```
