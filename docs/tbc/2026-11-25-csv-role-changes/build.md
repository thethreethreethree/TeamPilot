# BUILD - Team CSV changes roles too

No migration. No env keys.

### An admin changes roles by CSV
write-path: Team → Import a team from a CSV file → file with email, role → preview → Import → /api/team/import (apply)
→ setMemberRole per changed member (company-pinned, never the last admin) → profiles.role.
read-path: the preview lists "already on the team · role Member → Manager"; the results list "role: Member → Manager" or
the reason it was refused; the Team page shows the new roles.
