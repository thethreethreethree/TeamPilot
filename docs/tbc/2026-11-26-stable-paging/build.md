# BUILD - Stable order for paged reads

Migration 0347_hidden_calls_for_table.sql (applied). No env keys.

### Managers' lists and coverage
write-path: none.
read-path: hiddenInCompanyFrom (rpc ordered by session_id), hiddenFrom (call_hides ordered by id), coverage intel events
(created_at, id) — each row read once, at any size.
