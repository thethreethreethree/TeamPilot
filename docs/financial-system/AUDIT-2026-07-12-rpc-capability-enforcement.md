# Foundation audit — capability enforcement inside the finance write RPCs

**Date:** 2026-07-12 · **Layer (§1.7):** RLS/authz · **Stance:** outside-view (§1.3)
**Trigger:** proactive audit (§1.5.2). The earlier route sweep proved every finance *route* is
user-scoped, but Supabase exposes RPCs directly to any authenticated client — so the real question
is whether the RPCs themselves enforce the finance-role capability model, independent of the route.

## The threat modeled

A finance role is a separate dimension (viewer / accountant / approver / controller / cfo) finer
than table-level RLS. Attack: a low-privilege member (e.g. `viewer`) skips the UI and calls a
mutating RPC — `fin_post_entry`, `fin_approve_bill`, `fin_reimburse_expense_report` — straight from
the client. If a `SECURITY DEFINER` RPC (which bypasses RLS) does not self-check capability, the
member posts to the ledger or moves cash above their privilege.

## Method + a corrected false alarm (the point of §0)

A first pass with a crude `grep`/`awk` over the migrations flagged ~10 RPCs as having "NO fin_can_
guard," including several `SECURITY DEFINER` approval functions — an apparent HIGH finding. **It was
a false alarm:** the awk terminated each function at the `language plpgsql` token on its *signature*
line, before ever scanning the body where the guard lives. Reading the actual source (the §0
understanding gate) overturned every flag. Recorded here precisely because it is the §5 lesson in
miniature — grep pattern-matching *imitates* an audit; reading the source *is* one. A confident
finding that arrived in one grep was wrong.

## Findings (verified by reading each body)

**All mutating finance RPCs are capability-gated. No flag.** Two layers of defense:

| RPC | Security | Capability guard | Tenant check | SoD |
|-----|----------|------------------|--------------|-----|
| `fin_post_entry` | DEFINER | `fin_can_approve()` (post needs approver+) | via entry row | created_by≠poster (SoD in body) |
| `fin_approve_bill` | DEFINER | `fin_can_approve()` | `auth_company_id()` | creator≠approver |
| `fin_approve_expense_report` | DEFINER | `fin_can_approve()` | `auth_company_id()` | employee≠approver |
| `fin_reimburse_expense_report` | DEFINER | `fin_can_approve()` | `auth_company_id()` | — (approve-gated) |
| `fin_approve_po` | DEFINER | `fin_can_approve()` | `auth_company_id()` | creator≠approver |
| `fin_convert_po_to_bill` | DEFINER | `fin_can_enter()` | `auth_company_id()` | — (creates draft only) |
| `fin_generate_recurring_bill` | DEFINER | `fin_can_enter()` | `auth_company_id()` | — (creates draft only) |
| `fin_run_due_recurring` | DEFINER | delegates → `fin_generate_recurring_bill` (which checks `fin_can_enter`) | `auth_company_id()` | — |
| `fin_init_company` | DEFINER | `fin_can_configure()` | `auth_company_id()` | — |

**Second layer — table RLS (0118).** The ledger tables independently carry the capability check, so
even direct table access (not via RPC) is gated: `fin_journal_entries` and `fin_journal_lines`
insert/update/delete policies all require `company_id = auth_company_id() AND fin_can_enter()`;
select requires `fin_can_view()`. Posting is further restricted (draft→posted transition only via
the DEFINER `fin_post_entry`, which requires `fin_can_approve`). The expense tables scope writes to
`employee_user_id = auth.uid()` while draft, with `fin_can_view` for others' visibility.

## Verdict

The finance capability model is enforced at BOTH the RPC layer and the table-RLS layer — a viewer
cannot post to the ledger, approve a document, or move cash by calling any RPC directly. Verified by
reading every mutating function body, not by pattern match. On-record baseline (§1.7 rule 4);
compare future authz audits against it. Complements the DB-authz sweep memory
(project_db_authz_audit_2026_07_07) — that covered the core product tables; this covers the finance
subsystem's RPC surface specifically.
