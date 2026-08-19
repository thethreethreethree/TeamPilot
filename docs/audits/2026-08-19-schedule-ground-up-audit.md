# Ground-up audit — Schedule Management System (1.7, Phase 8)

Outside-view (1.3), foundation-up. Built fast across ~27 commits this session, so audited as if someone
else's. An empty flag list would itself be suspicious (1.7) — the honest flags are at the end.

## Layer 0 — Environment / external config (A41 / 1.5.3)
- ✅ **DeepSeek** live-verified: `/api/health` → `llmReady:true, providers.deepseek:true, activeProvider:deepseek`.
- ✅ LLM/heavy routes export `maxDuration` (commit, propose, evaluate). Preview is a pure parse (no LLM), correctly none.
- 🟨 **MED — org timezone ABSENT.** `companies.timezone` does not exist (verified). Shift times are stored/compared as "HH:mm" strings; correct within a day, but cross-midnight coverage windows + any real multi-tz use need a stored tz. **Flag RQ4** — add `companies.timezone` + backfill before real cross-tz scheduling.
- ℹ️ Supabase env assumed present per-environment (the app runs); per A41, verify preview *and* prod when the module goes to a customer.

## Layer 1 — Schema / events (3.1)
- ✅ **Append-only enforced + live-verified.** `0220` raise-trigger + revoked grants; the permanent `verify:live` registry asserts the trigger (a future migration dropping it fails CI). Behavioral live check confirmed UPDATE/DELETE both raise.
- ✅ **Event-integrity CLEAN.** No `UPDATE`/`DELETE` on `schedule_event` anywhere outside `0220`. Corrections are new events.
- ✅ **Tenant isolation.** `company_id` + RLS (`auth_company_id()`); the invariant gate confirms every schedule mutation route references an auth/tenant gate.
- ✅ Roster (`0221`) + atomic import (`0222`) applied via `db:apply` (ledgered); `verify:live` 27/27 after each.

## Layer 2 — Derivation (projector)
- ✅ Pure + deterministic (no clock/random/IO); replay-determinism + order-independence + purity tested.
- ✅ **No direct derived-state writes** (D2 — derived tables deliberately not persisted; the projector is the source, per A31).
- ✅ Forward-compatible: unknown event types + malformed payloads are no-ops (replay survives vocabulary growth).

## Layer 3 — Constraints (4)
- ✅ Hard (pass/fail) vs soft (score) kept in distinct return shapes; boundary-tested (exactly-at-min coverage MEETS, exactly-at-max hours WITHIN); NaN-safe.

## Layer 4 — Verdict authority (A40 / 2.2)
- ✅ **Single source.** `meetsCoverage`/`isEligible`/`withinLimits` are called ONLY inside `authority.ts` (grep-proven; the one other hit is a comment). Resolution search reuses `evaluateChange`, never re-derives.
- ✅ Drift-guard tests exercise both branches of every term, especially the override (overridable coverage vs absolute conflict).

## Layer 5 — AI layer (5 / 3.3)
- ✅ **Advisory by construction:** `ai.ts` imports `llmCall`/fence/voice/eventSchema only — NOT constraints/authority. It cannot compute the gate or override the verdict.
- ✅ **Fenced:** untrusted text carries `CONVERSATION_IS_DATA` (4 uses across parse + mapping prompts).
- ✅ **Validated + fail-loud:** a parsed event is schema-validated before it can be written; a malformed parse returns "unclear"; the mapping proposal omits codes it cannot read (never guessed); the review proposal fails soft (the deterministic verdict always stands).

## Layer 6 — Interface (routes + UI)
- ✅ Every write route: authenticated + company-scoped + **manager-gated** (`ctx.isAdmin`); `company_id` server-resolved (tenant-pin, never the body).
- ✅ Honest errors (no false-empty; a read failure is a real 5xx); no raw error `.message` to the client (CWE-209 gate passes).
- ✅ UIs theme-safe (0 leaks) + typecheck-clean.
- ℹ️ **UI render not yet visually verified by the founder** — the gate can't render React; roster/grid/import/timeoff/coverage need a human look.

## Open flags (ranked by severity)
| # | severity | flag | recommendation |
|---|----------|------|----------------|
| RQ4 | **MED** | org timezone not stored | add `companies.timezone` + backfill before cross-tz / cross-midnight scheduling |
| RQ6 | ✅ **FIXED** | event-append route now role-per-event-type gated | manager-only types require ctx.isAdmin; TIMEOFF_REQUESTED/AVAILABILITY_SET/SWAP_REQUESTED open to members. 4 tests. |
| — | LOW | re-import de-dup (import-once assumed) | skip a shift key already present on re-import |
| — | LOW | requirement→shift mapping is first-version (day-applies / time-overlap) | refine when coverage is defined against specific shifts |
| — | LOW | event payload shiftId/employeeId not route-validated vs the company's real shifts/roster | inert (projector ignores unresolved ids + RLS scopes events); add a check for tidiness |
| — | INFO | UI render unverified by a human | founder visual pass on the 5 schedule pages |

## Verdict
The schedule system is **structurally sound foundation-up.** No CRITICAL or HIGH flags. The event-sourcing
discipline, single-source verdict (A40), advisory-only LLM, tenant isolation, and append-only enforcement all
hold and are gate/live-verified. The open flags are MED (tz, role-gate) and below, each recommended, none
blocking the manager MVP. Not yet go-live for employee-facing use (Phase 6 + the MED flags) — go-live-ready as
a manager tool once the founder visually confirms the UIs.
