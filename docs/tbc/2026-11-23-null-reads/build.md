# BUILD - Failed reads shown as "none" (the null form)

No migration. No env keys.

### Seven reads that now fail loud
write-path: none.
read-path: RepArena (points) → "Couldn't load your points"; MyProgress → "Couldn't load your progress"; call page
dissect → "Couldn't load this call's saved dissect"; call page Ask Coach → "Couldn't load your earlier questions";
Training → Assign → "Couldn't load your team"; Pipeline "Whose pipeline" and Search rep/tracker filters → a disabled
"Couldn't load … — refresh" option; Search saved searches → a line; role-play assignment / scenario → the existing
"Couldn't load …" instead of "isn't assigned to you" / "isn't available"; Command Center → "C.A.R.E activity" joins
the load-error banner.

### The guard
write-path: src/lib/__tests__/noFailedReadAsEmpty.test.ts — NULL_PATTERN over src/components and src/app; NULL_ALLOWED
lists the 7 label reads with counts and reasons; a spare or missing allowance fails.
read-path: `npm run check` (vitest).
