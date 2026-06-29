-- 0072_sales_coach_role.sql
--
-- Sales Coach as a standalone product within Elostate — Phase 1 (shell)
-- foundation (founder request 2026-06-28). Adds a per-product role flag
-- on profiles, mirroring how C.A.R.E decouples support-agent capability
-- from the company CEO/COO/member role (is_support_agent). Founder
-- choice 2026-06-28: a Sales-Coach-specific role, so anyone can be made
-- Sales Coach staff or admin regardless of their Elostate role.
--
--   - NULL  = not a Sales Coach user
--   - staff = uses the Sales Coach product
--   - admin = manages the Sales Coach product (Team / Settings)
--
-- NOT yet enforced anywhere — this is the column the Team + Settings
-- phases will gate on. Idempotent (§A12).

alter table profiles
  add column if not exists sales_coach_role text
    check (sales_coach_role in ('admin', 'staff'));
