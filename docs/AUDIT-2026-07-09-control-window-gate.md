# Audit — §3.4 control-window gate integrity across all AI surfaces (2026-07-09)

**Trigger:** working in the LLM layer for Experience Mode surfaced the question — `runBrainCall`/`runBrainStream` enforce the §3.4 month-1 control window (guidance OFF during the baseline month; the "honesty is the moat" rule), but **direct `llmCall`/`llmStream` callers bypass that gate**. Any diagnostic surface that reaches the model directly, when a real company is present, would violate §3.4 — the System would be guiding when it is supposed to be silently capturing a baseline.

**Method (§1.2 retrospective + §1.7 ground-up):** enumerated every direct `llmCall`/`llmStream` caller and classified each as legitimately-exempt or a gate-bypass.

**Result — CLEAN. The §3.4 gate is structurally intact.** Every diagnostic/coaching surface follows one pattern: `companyId ? runBrainCall/runBrainStream (GATED) : llmCall/llmStream (direct)`, and the direct branch runs only when there is **no company context** (demo / no-Supabase), where there is no month-1 window to gate.

| Direct caller | Verdict |
|---|---|
| `brain/index.ts` (inside `runBrainCall`/`runBrainStream`) | **Legit — this IS the gate path** (calls llmCall AFTER the gate check + composer) |
| `brain/learn.ts` (learning distillation) | **Legit exempt** — operates on aggregate data, not a per-team guidance turn |
| `claude.ts` `call()` no-`companyId` branch | **Legit** — used only by the demo/no-company callers below |
| `diagnosis/outsideView.ts` (72), `rippleTrace.ts` | **Legit** — `if (companyId) runBrainCall else llmCall`; direct only with no company |
| `chat/guide`, `chat/formulate`, `chat/summarize` (llmStream) | **Legit** — `if (companyId) runBrainStream else llmStream`; the direct branch is explicitly "Demo mode (no Supabase): bypass brain" |
| `chat/similar` (llmCall) | **Legit** — `companyId ? runBrainCall : llmCall` (route lines 139-147) |

**Conclusion:** no AI surface reaches the model directly when a real company is present — the §3.4 baseline-capture guarantee cannot be silently violated by a bypass. This is a clean bound (per §A29 a clean sweep is a real result) on a class critical to the product's core thesis. A future §1.7 audit can diff against it: the invariant to preserve is *every company-context AI call goes through `runBrainCall`/`runBrainStream`; a new direct `llmCall` in a company-context path is a §3.4 regression.*

## Sibling audit — the gate STATE (write side) — found a real gap → 0111

Enforcement (above) is clean, but the READ is only half. The gate STATE lives on
`companies.ai_guidance_enabled / ai_guidance_unlock_at / ai_guidance_enabled_at`.
Who can WRITE it? The intended unlock (`/api/brain/unlock`) is correctly
admin-gated ("only CEO/COO/admin can unlock the §3.4 control window — a
constitutional override"). But the RLS `company - update` policy (0095) is
`using/with check (id = auth_company_id())` — company-scoped, NOT role-scoped —
so ANY member can bypass that gate with a direct PostgREST
`UPDATE companies SET ai_guidance_enabled = true` and turn guidance ON during the
control month, defeating the §3.4 baseline (the single-variable experiment that
makes Month-2 improvement attributable to the method). Same route-gated-but-
RLS-open class as 0089/0090, on the product's CORE honesty control. The settings
PATCH is safe (ai_guidance_* not in ALLOWED_FIELDS) — the hole is direct-RLS only.
**Fixed: `0111` — a BEFORE UPDATE guard trigger freezing the ai_guidance_* columns
for authenticated non-admin writers (mirrors guard_profile_privileged_columns);
the admin unlock still passes, matching the route gate.** UNAPPLIED.

## Broader sweep — can a member tamper with ANY core-thesis control? (2026-07-09)

Generalized the finding into a class: a constitutional invariant stored in the DB
that is route-gated (or convention-gated) but RLS-open, so a member defeats it via
direct PostgREST. Swept the four core-thesis controls:

| Control (thesis) | Storage | Member-tamperable? | Status |
|---|---|---|---|
| §3.4 month-1 control window | `companies.ai_guidance_*` | YES — company-scoped RLS, no role gate | **FIXED 0111** (guard trigger) |
| brain / AI behavior | `company_brain.system_prompt_addendum` | YES — `for all` company-scoped → prompt injection | **FLAGGED** (docs/AUDIT-2026-07-09-brain-injection.md; risky fix, needs runtime test) |
| §3.2 Understanding Gate thresholds | `problem_thresholds` (min_signals…) | NO — RLS enabled, SELECT-only, writes default-denied (rls-audit allowlisted as service-role-only) | **CLEAN** |
| §3.1 derivation rules | `signal_sources` | NO — RLS enabled, read-only policy, writes default-denied (allowlisted) | **CLEAN** |
| §3.5 consequence measurement (C.A.R.E) | `support_durability_checks.outcome` | NO to regular members — UPDATE gated to support-agent OR CEO/COO/admin (0095) | **CLEAN vs members** (residual: any *agent* can set any check, not just the owner — a permission-model question already in the flagged §3.5-integrity family, items 1/3) |

So of the four constitutional controls a member might defeat, two were open (one fixed, one flagged) and two are correctly write-protected. The invariant a future §1.7 audit preserves: *every DB-stored constitutional control must be write-restricted to leadership/service-role at the RLS layer, not merely at a route or by convention* — the §3.4 window and company_brain both showed route/convention gates are not enough.

**Bearing:** §3.4 (honesty is the moat / no-instant-results), §3.2/§3.1 (gate + chain integrity), §1.7 (ground-up audit), §A29 (clean sweep bounds a class). Verified from source 2026-07-09.
