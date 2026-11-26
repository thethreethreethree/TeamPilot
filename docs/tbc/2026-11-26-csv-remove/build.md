# BUILD - Removing people with the team CSV

No migration. No env keys.

### An admin offboards people with a CSV
write-path: POST /api/team/import {csv, apply:true} → parseTeamCsv (action "remove", email only) → planImport (active member → remove; else not_member) → other rows first → removeMember for each removal, in order (never yourself, never the last active admin, row-count checked) → profiles.status 'removed'.
read-path: preview (apply:false) → each removal with how many people report to them → the import button's count → a confirm.

### An admin removes one person on the Team page
write-path: DELETE /api/team?memberId= → admin check → removeMember (the same rules).
read-path: the Team list without them.
