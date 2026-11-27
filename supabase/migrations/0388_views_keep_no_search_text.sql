-- 0388 — a saved deal-board view keeps its filters but not the search text (2026-11-27; erasure audit of 0370–0387;
-- the 0381 forecast-notes precedent). Re-runnable.
--
-- deal_board_views (0371) stored the board's search box (`q`) with a view. A search is usually a name — a customer's or a
-- company's — and the table is append-only and outside legal erasure's reach (§3.1.1(2)). The route now strips `q` when a
-- view is saved, and this check refuses one that still carries it. Production had 0 saved views (probe). The view's own
-- name (the person's label for the tab, 40 characters) stays; recorded as a residual.

alter table public.deal_board_views drop constraint if exists deal_board_views_no_search_text;
alter table public.deal_board_views add constraint deal_board_views_no_search_text check (not (filters ? 'q'));
