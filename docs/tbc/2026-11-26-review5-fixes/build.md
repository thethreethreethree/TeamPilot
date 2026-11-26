# BUILD - Acting on the fifth review

No migration. No env keys.

### Someone opens Sales Coach on a phone, then on a desktop
write-path: none.
read-path: phone → the tab bar's last cell is the bell (panel opens upward); desktop → the sidebar's brand row; sidebar
collapsed → a small bell at the top of the collapsed strip. One bell, one poll, one Realtime channel per page.

### Someone on Search opens a followed search from the bell
write-path: POST /api/coach/remote/saved-searches/events {kind: "seen"} (from the freshly loaded page).
read-path: bell → link → full load of /dashboard/remote-sales/search?…&saved=<id> → filters applied, seen recorded → the bell reloads.
