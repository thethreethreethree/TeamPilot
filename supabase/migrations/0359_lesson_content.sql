-- 0359 — what a lesson can hold besides text (2026-11-26; Gong ledger F17.2 "lesson content blocks"). Idempotent (A12).
--
-- A lesson step may now point at:
--   library_item_id — a call or clip saved in the company library (0280). The rep opens it in the library, where its
--     own rules decide whether they may play it (company folder, the rep's approval — canPlay); the course grants
--     nothing the library wouldn't.
--   link_url — an outside page (a video, a document), https only, shown as a link and never embedded.
-- Practice steps keep neither (0357's shape check is replaced to say so).

alter table public.training_course_steps add column if not exists library_item_id uuid references public.library_items(id);
alter table public.training_course_steps add column if not exists link_url text;
alter table public.training_course_steps drop constraint if exists training_course_steps_link_url_https;
alter table public.training_course_steps add constraint training_course_steps_link_url_https
  check (link_url is null or (link_url ~ '^https://[^\s]+$' and length(link_url) <= 500));
alter table public.training_course_steps drop constraint if exists training_course_steps_kind_shape;
alter table public.training_course_steps add constraint training_course_steps_kind_shape check (
  (kind = 'lesson' and scenario_id is null and length(trim(body)) between 1 and 4000)
  or (kind = 'practice' and scenario_id is not null and library_item_id is null and link_url is null and length(body) <= 4000)
);
