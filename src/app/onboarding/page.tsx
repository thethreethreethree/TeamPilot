"use client";

import {
  Activity,
  Building2,
  ChevronRight,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

const industries = [
  "Technology", "Finance", "Healthcare", "E-commerce", "SaaS", "Manufacturing",
  "Consulting", "Media", "Real Estate", "Education", "Other"
];

const sizes = ["1-10", "11-50", "51-200", "201-500", "500+"];
const stages = ["Pre-revenue", "Early Stage", "Growth", "Scale", "Enterprise"];

const goals = [
  "Improve team execution",
  "Reduce operational bottlenecks",
  "Better decision-making",
  "Faster task completion",
  "Department visibility",
  "AI-driven insights",
  "Accountability tracking",
  "Workload balance",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    industry: "",
    size: "",
    stage: "",
    selectedGoals: [] as string[],
    ceoName: "",
    // Step 5 — captured per AMD-006 §1.5.1 layer 2 (operational
    // effectivity): empty = Jeff hand-offs every question on day
    // one. Asking here while the founder is in setup mindset
    // gives C.A.R.E real day-one value. TT.md A4: keep it
    // skippable — many founders won't have polished copy yet
    // and forcing it would push the experiment closed.
    aiProductContext: "",
  });

  const totalSteps = 5;

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleGoal = (goal: string) => {
    setForm((prev) => ({
      ...prev,
      selectedGoals: prev.selectedGoals.includes(goal)
        ? prev.selectedGoals.filter((g) => g !== goal)
        : [...prev.selectedGoals, goal],
    }));
  };

  const finish = async () => {
    setSubmitting(true);
    setError("");
    if (!supabaseEnabled) {
      router.push("/dashboard");
      return;
    }
    const supabase = createClient();
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Your session expired. Please sign in again.");

      // 2026-06-17 — switched from two sequential client-side
      // writes (INSERT companies + UPSERT profiles) to one
      // server-side RPC (complete_company_onboarding from 0046).
      // The RPC wraps both writes in a single transaction, so a
      // network blip mid-onboarding rolls back cleanly instead
      // of orphaning a half-created company the user can't
      // access. Also fires the trigger pair from 0045 inside the
      // same transaction:
      //   - companies INSERT → care_tenant_config row
      //   - companies INSERT → company_brain row (trigger 0007)
      //   - profiles UPSERT → care_agent_state row
      // If any of these fail, the whole transaction rolls back.
      const { data: companyId, error: rpcErr } = await supabase.rpc(
        "complete_company_onboarding",
        {
          p_company_name: form.companyName,
          p_industry: form.industry,
          p_size: form.size,
          p_stage: form.stage,
          p_goals: form.selectedGoals,
          p_user_full_name: form.ceoName,
          // Migration 0047 — RPC now atomically writes the
          // product context into care_tenant_config when present.
          // Empty string short-circuits inside the function so
          // skipping the step leaves the column NULL (and Jeff
          // falls back to the AMD-006 safe-hand-off discipline).
          p_ai_product_context: form.aiProductContext.trim(),
        }
      );
      if (rpcErr) throw rpcErr;
      if (!companyId) throw new Error("Could not complete setup. Please try again.");

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete setup.");
      setSubmitting(false);
    }
  };

  const next = () => {
    if (step < totalSteps) setStep(step + 1);
    else finish();
  };

  const canProceed = () => {
    if (step === 1) return form.companyName.trim().length > 0;
    if (step === 2) return form.industry && form.size && form.stage;
    if (step === 3) return form.selectedGoals.length > 0;
    if (step === 4) return form.ceoName.trim().length > 0;
    // Step 5 (AI product context) — per TT.md A4 always proceedable;
    // an empty value is a valid intentional choice (the AMD-006
    // prompt discipline shipped earlier defaults Jeff to a safe
    // hand-off when context is absent).
    if (step === 5) return true;
    return true;
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#FACC15]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FACC15] to-[#FDE047] flex items-center justify-center shadow-glow">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-bold text-primary">ELOSTATE</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                i + 1 <= step ? "bg-[#FACC15]" : "bg-surface-raised"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="glass-card p-8 fade-in">
          {/* Step 1: Company name */}
          {step === 1 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center mb-5">
                <Building2 className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">What&apos;s your company called?</h2>
              <p className="text-sm text-muted mb-6">ELOSTATE will personalize everything around your business.</p>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                placeholder="Acme Corp"
                autoFocus
                className="w-full bg-surface border border-default rounded-lg px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors text-base"
              />
            </div>
          )}

          {/* Step 2: Company profile */}
          {step === 2 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center mb-5">
                <Target className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">Tell us about {form.companyName}</h2>
              <p className="text-sm text-muted mb-6">This helps the AI understand your operating context.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">Industry</label>
                  <div className="flex flex-wrap gap-2">
                    {industries.map((ind) => (
                      <button
                        key={ind}
                        onClick={() => update("industry", ind)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          form.industry === ind
                            ? "bg-[#FACC15]/15 border-[#FACC15]/50 text-brand"
                            : "border-default text-muted hover:border-strong hover:text-secondary"
                        }`}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">Team size</label>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => update("size", s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          form.size === s
                            ? "bg-[#FACC15]/15 border-[#FACC15]/50 text-brand"
                            : "border-default text-muted hover:border-strong hover:text-secondary"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">Stage</label>
                  <div className="flex flex-wrap gap-2">
                    {stages.map((s) => (
                      <button
                        key={s}
                        onClick={() => update("stage", s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          form.stage === s
                            ? "bg-[#FACC15]/15 border-[#FACC15]/50 text-brand"
                            : "border-default text-muted hover:border-strong hover:text-secondary"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Goals */}
          {step === 3 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center mb-5">
                <Target className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">What are your top priorities?</h2>
              <p className="text-sm text-muted mb-6">Select all that apply. ELOSTATE will focus its intelligence here.</p>
              <div className="grid grid-cols-2 gap-2">
                {goals.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => toggleGoal(goal)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border text-left transition-all ${
                      form.selectedGoals.includes(goal)
                        ? "bg-[#FACC15]/15 border-[#FACC15]/50 text-brand"
                        : "border-default text-muted hover:border-strong hover:text-secondary"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        form.selectedGoals.includes(goal) ? "bg-[#FACC15]" : "bg-surface-raised"
                      }`}
                    />
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: CEO name */}
          {step === 4 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center mb-5">
                <Users className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">Who are you?</h2>
              <p className="text-sm text-muted mb-6">
                ELOSTATE will personalize your executive experience.
              </p>
              <input
                type="text"
                value={form.ceoName}
                onChange={(e) => update("ceoName", e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full bg-surface border border-default rounded-lg px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors text-base mb-4"
              />
              {form.ceoName && (
                <div className="bg-[#FACC15]/10 border border-[#FACC15]/20 rounded-xl p-4 fade-in">
                  <p className="text-sm text-secondary">
                    Welcome, <span className="text-primary font-semibold">{form.ceoName}</span>.
                    One last optional step before ELOSTATE activates for{" "}
                    <span className="text-primary font-semibold">{form.companyName}</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: AI product context (optional) — captured
              per AMD-006 layer 2 (operational effectivity).
              Without it, the customer-facing AI defaults to
              "let me bring in a teammate" for every question on
              day one; with it, the AI has the language to
              respond accurately about the tenant's product.

              TT.md A4 (defer uncertainties): skippable — many
              founders won't have polished copy at signup, and
              forcing it would push them to close the tab. Empty
              = safe default per the AMD-006 prompt discipline.

              TT.md A18 (label invites): copy invites
              "describe your offering so the AI helps customers
              accurately," NOT "configure your AI" (which reads
              as work). */}
          {step === 5 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center mb-5">
                <Sparkles className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">
                What does {form.companyName || "your business"} offer?
              </h2>
              <p className="text-sm text-muted mb-4">
                A few sentences your customer-facing AI can ground in. Skip
                if you&apos;d rather add this later — your AI will hand off
                to you until you do.
              </p>
              <textarea
                value={form.aiProductContext}
                onChange={(e) =>
                  update("aiProductContext", e.target.value)
                }
                rows={8}
                placeholder={`What ${form.companyName || "your business"} actually does:
[one sentence — the product in plain terms]

Features customers will ask about (use these names when answering):
- [Feature 1] — [one sentence: what it does]
- [Feature 2] — [...]

Pricing & access:
[what plans you offer / how customers sign up]

Always hand off to a human for:
[account-specific data, billing, refunds, anything sensitive]`}
                className="w-full bg-surface border border-default rounded-lg px-3.5 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors resize-y leading-relaxed font-mono"
              />
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                Listing features by name makes &quot;yes, we have that&quot;
                the AI&apos;s safe default for things you actually offer.
                Anything you don&apos;t name, the AI will hand off rather
                than guess.
              </p>
            </div>
          )}

          {/* Footer */}
          {error && <p className="text-xs text-red-400 mt-6">{error}</p>}
          <div className="flex items-center justify-between mt-8">
            <span className="text-xs text-muted">Step {step} of {totalSteps}</span>
            <button
              onClick={next}
              disabled={!canProceed() || submitting}
              className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
            >
              {submitting
                ? "Launching…"
                : step === totalSteps
                ? "Launch ELOSTATE"
                : "Continue"}
              {step === totalSteps ? <Activity className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
