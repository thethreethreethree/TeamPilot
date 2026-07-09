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

**Bearing:** §3.4 (honesty is the moat / no-instant-results), §1.7 (ground-up audit), §A29 (clean sweep bounds a class). Verified from source 2026-07-09.
