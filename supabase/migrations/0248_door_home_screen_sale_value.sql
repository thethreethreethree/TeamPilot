-- 0248 — Door home screen: the manager-set $-PER-SALE value the cash box needs.
--
-- The door screen's bottom box shows "Earned today $__ / $__ per sale / $__ to goal" (founder 2026-09-10:
-- match the mockup's cash box). "Earned" is sold × value-per-sale, so we need a per-rep dollar value. It is
-- set by the MANAGER alongside the daily sales goal (same table, same RLS — no new policies needed).
--
-- Stored in CENTS (integer) to avoid float money. Nullable: until a manager sets it, the screen degrades to
-- the plain "sales to goal" line rather than fabricating a $0 (§3.4 honesty). Additive + safe (A34): existing
-- rows keep a null value, and the read/write code guards the column with isMissingColumnError until this applies.

alter table rep_daily_sales_goal
  add column if not exists sale_value_cents integer check (sale_value_cents is null or sale_value_cents >= 0);

comment on column rep_daily_sales_goal.sale_value_cents is
  'Door home screen cash box (0248): dollar value per sale, in CENTS, manager-set. NULL → the screen shows sales-to-goal instead of dollars.';
