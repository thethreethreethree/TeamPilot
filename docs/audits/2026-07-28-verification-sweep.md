# Verification sweep — 2026-07-28

A record of the security + correctness dimensions verified this session (against the *actual* code /
live DB / production, not comments). Each was checked by reading the real policy/logic and, where
noted, runtime-proven. This is the evidence trail behind "the codebase is sound" — useful for audit,
due-diligence, and as a regression baseline. Findings (not just clean results) are marked ⚠ and linked
to `FOUNDER-ACTION-QUEUE.md`.

## Pilot access-code system (built this session)
| Dimension | Result | Evidence |
|---|---|---|
| RPC provisioning (all 3 modules) | sound | runtime-verified, rolled-back live txns |
| Single-use enforcement | sound | row-lock in `redeem_pilot_code`; runtime-proven double-redeem rejected |
| Constraints (unique code / module check / FK) | sound | live `pg_constraint`; CHECK runtime-proven to reject bad module |
| Function grants (anon revoked on redeem) | sound (fixed 0198) **+ now live-guarded** | `verify:live` INVARIANT 12b asserts `anon` can't execute `redeem_pilot_code` while `authenticated` can; detection-tested (rolled-back anon-grant trips it) — a future re-grant now fails CI |
| RLS seal (no member policies) | sound **+ now live-guarded** | rls-audit allowlisted, deny-all-by-design; `verify:live` asserts `pilot_codes` keeps RLS-on + 0-policies (access-key table, `redeemed_company_id` not `company_id` so tenant-RLS guard misses it) — detection-tested (rolled-back policy-add trips it) |
| Routes (validate/redeem) | sound | 10 unit tests; live prod 200 |
| §1.5 concurrency race (F0) | fixed 0199 | `for update` on profile read; class swept |
| Deploy / launch path | sound | prod `/redeem` 200, validate live, health ok |

## Security classes swept
| Class | Result |
|---|---|
| Read isolation (chat/files/notifications/tasks/support) | sound except **⚠ support-search** (company-readable vs agent-gated console) |
| Public-endpoint attack surface (15 no-auth routes) | all intentionally-public-and-safe or auth'd otherwise |
| Injection — PostgREST `.or()` (search) | sound (`sanitizeOrIlikeTerm`, tested) |
| Injection — CSV formula (CWE-1236) | sound + complete (`=+-@\t\r`, anchored number exception, fully tested) |
| Injection — prompt (LLM paths) | sound (`CONVERSATION_IS_DATA` fence; verified earlier sessions) |
| Mass-assignment / prototype-pollution | clean (zod-strip before any body-spread; no raw-body→DB) |
| SSRF (server fetch → user URL) | clean (all fetches to constant/config hosts) |
| CSRF / cookie SameSite | sound (`SameSite=Lax` → cross-site POSTs unauthenticated) |
| Webhook auth (inbound email) | sound (secret-gated, constant-time, fail-closed) |
| Extension token handoff | **⚠ fail-open when `NEXT_PUBLIC_CARE_EXTENSION_ID` unset** — fine for pilot, pin before public launch |
| Widget embed origin validation | sound (exact-match whitelist, dev-only wildcard, production-strict) |
| Signed-URL gating (§A27) | sound (all 3 issuance points gate before signing) |
| Gate-predicate drift (admin / sales-coach-manager) | **consolidated** to canonical predicates (9 sites); remaining ~13 inline hand-rolls **audited for semantic divergence → ZERO** (all enumerate exactly `{CEO,COO,admin}` = `isAdminRole`; none over-permissive, none locks out an admin). Drift is cosmetic-only, no latent authz hole; consolidation now *proven* behavior-preserving. `RoleSchema` (invite-only, admin excluded by design) and `chats:359` (per-topic `chat_participants.role`) are correct-by-design, not divergence. |
| Nav-stall class (AMD-006 L3) | fixed both shells + DRY + tested |
| Team-invite / join continuity (AMD-006 L3 — pilot admin's NEXT step) | sound — `/invite/[code]` handles all member states (new→signup-then-accept, existing→confirm-accept, demo→clear error), no dead-end; email-confirm-OFF path fires accept with the fresh ssr cookie (server sees `auth.user`); pilot admin can invite → teammate joins → full loop closes past redemption. Raw `accept_invitation` errors are user-meaningful (expired/accepted/invalid), safe to surface — not a CWE-209 leak |
| `fin_effective_role` auto-grant | intended (bootstrap-admin, overridable) — not a bug |

## Correctness classes swept
| Class | Result |
|---|---|
| Division-by-zero / empty-data | all guarded app-wide (grep "candidates" were guards outside the window) |
| Metric integrity — §3.5 coach-readout | sound (consequence-anchored, ITT partition, durable timestamp, test-locked) |
| Metric integrity — C.A.R.E analytics | sound (negative-duration dropped, empty→null, durable `resolved_at`) |
| Empty-company launch safety (fresh pilot co) | sound (dashboards render null/0, no NaN/crash) |
| Pilot vs normal-onboarding parity (AMD-006 L2 — does redemption produce a *complete* company?) | sound — both paths `insert into companies` → same 0045 triggers seed `care_tenant_config`/`care_agent_state`/`company_brain` (runtime-proven: care-plan update needs the row). Only diff = `industry/size/stage/goals` NULL, consumed ONLY by Settings (NULL-graceful), NOT by any AI/coach/care context builder. No missing foundational rows, no downstream break. `ai_product_context` NULL = the already-flagged F3 (founder-gated) |
| Webhook idempotency (inbound email) | sound (dedup on MessageID + 23505 concurrent-retry catch) |
| Constitution metadata drift | fixed + guarded (INVARIANT 12) |
| Cron schedule wiring | sound (all 6 → existing gated routes; no dead-route scheduling) |
| Rate-limit bucket ids | sound (all unique; no cross-route bucket sharing) |
| Security headers (clickjacking/HSTS/nosniff/referrer/permissions) | sound — full set on app routes (live-verified on `/dashboard`); widget route correctly omits only `X-Frame-Options` via negative-lookahead regex so cross-origin embed works; CSP is a documented reasoned deferral |
| Pilot code typo-safety (client hand-types these) | sound — 100/100 unambiguous alphabet (no `0/O/1/I/L`), all 7-char, all unique (live-DB) |

## Open findings (in FOUNDER-ACTION-QUEUE.md)
- ⚠ support-content searchable by non-agents (access-policy decision)
- ⚠ `NEXT_PUBLIC_CARE_EXTENSION_ID` unset → connect handoff fail-open (fine for pilot; pin before public launch)
- widget bootstrap un-rate-limited per-call write (known trade-off; write-dedup fix available)
- ~10 inline admin-role checks not yet consolidated to `isAdminRole` (behavior-preserving follow-up)

_Method: each row was verified against the actual code/policy/live-DB this session — several runtime-proven._
