# Sales Coach route surface — security/privacy audit (2026-07-31)

Ground-up audit of the Sales Coach API surface (`src/app/api/coach/sales-session/*` + the shell nav),
triggered by the founder's urgent Sales Coach revisions this session. Walks each route's tenant / cross-person /
privilege / private-data boundary and records how it is covered. **Result: no cross-tenant or cross-person gap;
every private-data exposure is disciplined.** This is the on-record artifact for that audit.

## Coverage by route

### A. Explicitly test-locked this session (the load-bearing boundaries)
| Route | Boundary locked | Test |
|---|---|---|
| `[id]/after-pitch` GET | A18: owner sees scores; **manager gets scores stripped**; cross-company 404 | `route.test.ts` |
| `elo` GET | owner-only rating; peer read → 403; cross-company → 404; **manager gets history stripped** | `route.test.ts` |
| `list` GET | admin-client read scoped: rep → own `agent_id`; manager → whole company | `route.test.ts` |
| `team` POST | **privilege escalation**: role-grant is manager-only (no self-promote) + company-scoped write + 404 on 0-row | `route.test.ts` |
| `corpus` POST/GET | methodology write/read manager-gated | `route.test.ts` |
| `product` POST | product write manager-gated, appended under the `product` kind | `route.test.ts` |
| `[id]/label-transcript` POST | diarization labeling (tapped speaker → agent, others → customer) + 401/404 | `route.test.ts` |
| `[id]` after-pitch redirect (B1) | recording → After-Pitch (upload + live, fire-once) | `LiveCoachingPanel` + component flow |

### B. Verified sound by inspection (admin-client writes correctly gated pre-mutation)
- `[id]/why` — owner check (`session.agentId !== user → 403`) before the append-only event insert.
- `[id]/save-recording` — owner/admin gate + `.eq("id").eq("company_id")` double-scope on the update.
- `voice`, `coach-assessment` — manager-gated (403 non-manager) + company-scoped.
- `[id]/upload-recording` — RLS-authorized `getSession(id)` (→ 404 if inaccessible) BEFORE the `admin.update().eq("id",id)`.
- `attribute` — read-only (LLM speaker classification); its admin read of `care_tenant_config` is
  `.eq("company_id", <auth-derived>)`.
- `team-analytics` GET — manager-gated (403 non-manager); deliberately aggregate-only (the only per-person
  number is a COUNT of active coaches — no per-person private data).

### C. Structurally covered (no per-route test needed — a shared gate already guards the class)
- `review`, `roleplay` — tenant scope is enforced purely by RLS via `getSession`/`getSessionTranscript`
  (RLS-audit is the structural guard).
- `strategy-library` — self-scoped `.eq("agent_id", auth.user.id)` over RLS-owner-only `after_pitch_summaries`.
- `dashboard` — `agentId = auth.user.id` (derived from auth, never a param) → self only.
- Every `?agentId=` cross-person route — **invariant-audit INVARIANT 6** requires `canManagerViewRepSkills`; a
  green invariant-audit proves there is no ungated `?agentId=` route (that green run is why `dashboard` was
  confirmed self-only without a param gate).

## Residual notes (not gaps)
- **B1 leaves the session `active`** after a recording (the After-Pitch page generates regardless). Whether to
  also mark it `ended` is a founder decision (would also surface the call duration). Recorded, not a bug.
- **Product injected into every prompt** (methodology + product both, across 8 engines). Consistent with the
  existing methodology pattern; a token-cost consideration at very large corpora, not a correctness issue —
  founder cost-policy call if it ever matters.
- The `nav` grouping keeps Manager-Dashboard items rep-visible (gating whole sections would break rep access);
  founder decision if entire sections should be manager-only.

Companion audits this session: `2026-07-31-cwe209-error-leak-sweep.md` (CWE-209, complete + INV14 guard),
`2026-07-28-fin-definer-revoke-ineffective.md` (finance DEFINER revoke — precondition verified, fix founder-gated).
