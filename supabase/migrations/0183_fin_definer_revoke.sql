-- 0183 — SECURITY: nine SECURITY DEFINER helpers were callable by any authenticated user, with the TENANT
--        SUPPLIED AS A PARAMETER.
--
-- Severity: MEDIUM (cross-tenant read + cross-tenant write into the chart of accounts).
-- NOT EXPLOITED: two of the nine are from unapplied migrations; the rest are read-only helpers. Fixed here.
--
-- ── HOW THIS WAS FOUND, AND WHY IT MATTERS MORE THAN THE BUG ─────────────────────────────────
--
-- A30 says: a green gate is a statement about the GATE'S VOCABULARY, never about the system. So I asked
-- what `rls:audit` cannot see. It checks tables. It now checks views. IT HAS NO CONCEPT OF A FUNCTION —
-- and a SECURITY DEFINER function bypasses RLS entirely, by design.
--
-- The sweep: every DEFINER function that accepts a company/tenant as a PARAMETER, and never constrains that
-- parameter against auth_company_id(). PostgREST exposes every public function as an RPC endpoint, so any
-- authenticated user can call one directly with SOMEBODY ELSE'S company id.
--
--   fin_obe_account(p_company)         → INSERTS an account into another company's chart of accounts.
--   fin_inventory_accounts(p_company)  → INSERTS THREE accounts into another company's chart of accounts.
--   fin_account_by_code(p_company, …)  → returns another company's account ids (enumeration).
--   fin_approval_limit_for(p_company,…)→ returns another company's approval ceilings.
--   fin_get_rate / mileage / per-diem  → returns another company's configured rates.
--
-- ── AND THIS IS A30 CONFIRMING ITSELF ────────────────────────────────────────────────────────
--
-- 0122 ALREADY KNEW. It ends with:
--
--     revoke execute on function fin_post_system_entry(...) from authenticated, anon;
--
-- Someone understood the danger exactly — a DEFINER function taking p_company must not be client-callable,
-- or a user of company A can post journal entries into company B's ledger. They fixed the one in front of
-- them. They wrote it in SQL. AND NOTHING ENCODED THE RULE.
--
-- So the next NINE helpers with the same shape were written without it — including two of mine, in this
-- session, while I was writing an essay about exactly this failure mode.
--
--   The lesson was learned. The lesson was written down. The lesson was not GATED. The lesson returned.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────────────────────
--
-- Revoke EXECUTE from `authenticated` and `anon`. These are INTERNAL helpers: they are called from other
-- DEFINER functions, which execute as the owner, so revoking client access does not break the internal
-- call path. None of the nine is called from the application (verified by grep before writing this).
--
-- The alternative — adding `if p_company <> auth_company_id() then raise` to each — was rejected: it is
-- nine copies of a rule, and the tenth author will forget it too. Revoking removes the ATTACK SURFACE
-- rather than defending it. You cannot call what you cannot reach.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- Read-only helpers: they leak another tenant's configured rates, limits and account ids.
revoke execute on function fin_get_rate(uuid, char(3), char(3), date)        from authenticated, anon;
revoke execute on function fin_account_by_code(uuid, text)                    from authenticated, anon;
revoke execute on function fin_approval_limit_for(uuid, uuid)                 from authenticated, anon;
revoke execute on function fin_mileage_rate_for(uuid, date, text)             from authenticated, anon;
revoke execute on function fin_per_diem_rate_for(uuid, date, text)            from authenticated, anon;

-- WRITE helpers: these two INSERT into another company's chart of accounts. Both are mine, from this
-- session — written after I had already documented this exact class, which is the whole point of A30.
revoke execute on function fin_obe_account(uuid)                              from authenticated, anon;
revoke execute on function fin_inventory_accounts(uuid)                       from authenticated, anon;

-- fin_post_system_entry was already revoked in 0122 and again in 0147. Re-asserted here so that the rule
-- lives in ONE place a reader can find, rather than being rediscovered at the bottom of two migrations.
revoke execute on function fin_post_system_entry(uuid, date, uuid, text, text, jsonb) from authenticated, anon;
