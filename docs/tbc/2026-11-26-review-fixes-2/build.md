# BUILD - Fixes from the second 26 Nov review

No migration. No env keys.

### KPI team table
write-path: saving a quota → loadTeam(false, teamPick).
read-path: the chosen team stays; a refused or failed team shows "That team isn't one you can see." / "Couldn't load
that team." with no rows; a slow earlier response is ignored.

### Library
write-path: saving to an archived folder restores it (as before).
read-path: the call panel says "That folder was archived — it's back…"; archived folders aren't suggested; Library →
"Empty folders (N)" → Archive.
