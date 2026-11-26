# CHECK - Moving a library folder

## Commands

```
npm run db:verify → 0360 ok; constraint probe → library_folder_events_kind_check present; npm run db:apply → verify:live passed; after: kind_shape
production Postgres, one rolled-back transaction → 8/8: move to top; view shows it; branch into a folder → 3 levels ok; loop refused; into itself refused; 4 levels refused; create at 4 levels refused (current parents); archive still accepted
npx vitest run library (route, folders, lib, page) → 29 + 6 passed
noFailedReadAsEmpty, americanSpelling → 7 passed; theme:audit clean; invariant-audit 0; tsc clean; eslint clean
npm run check → gates the commit
```

## Findings

### F1 - folders couldn't move
class: missing write (F12.6).
sweep: the library.
severity: low

### F2 - archive state would have flipped on a move
class: a "latest event" rule that assumed one kind of event.
sweep: archivedFolderIds, the only reader of folder events.
severity: medium (caught before any move existed)
