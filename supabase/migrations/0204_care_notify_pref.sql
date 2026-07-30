-- 0204 — per-user C.A.R.E notification preference (comprehensive settings, pillar 3).
--
-- Today C.A.R.E has exactly ONE push event: notifyAssignedAgentOfCustomerMessage — the assigned agent is
-- pushed when a customer replies on their conversation (careNotify.ts). It is all-or-nothing; an agent who
-- doesn't want those pushes has no control short of unsubscribing from ALL notifications.
--
-- This adds a per-user opt-out on profiles. Default TRUE = current behavior preserved (no silent change for
-- anyone). The send path (careNotify) reads it A34-guarded: if this column is absent (migration unapplied),
-- it degrades to sending — i.e. exactly today's behavior — so nothing breaks before apply.
--
-- Per-user + self-scoped: profiles RLS already restricts a user to their own row, matching theme_preference
-- / learning-mode / experience-mode which live here too.

alter table if exists public.profiles
  add column if not exists care_notify_customer_reply boolean not null default true;

comment on column public.profiles.care_notify_customer_reply is
  'Per-user opt-out for the C.A.R.E "customer replied on your assigned conversation" push. Default true = notify. Read A34-guarded by careNotify.ts (missing column → notify).';
