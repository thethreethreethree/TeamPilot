"use client";

import { Activity, Building2, Users, Target, ChevronRight } from "lucide-react";
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
  });

  const totalSteps = 4;

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

      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .insert({
          name: form.companyName,
          industry: form.industry,
          size: form.size,
          stage: form.stage,
        })
        .select("id")
        .single();
      if (companyErr) throw companyErr;

      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: auth.user.id,
        company_id: company.id,
        full_name: form.ceoName,
        role: "CEO",
      });
      if (profileErr) throw profileErr;

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
    return true;
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#C8232C]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C8232C] to-[#F75663] flex items-center justify-center shadow-glow">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-bold text-primary">ExecOS</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                i + 1 <= step ? "bg-[#C8232C]" : "bg-surface-raised"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="glass-card p-8 fade-in">
          {/* Step 1: Company name */}
          {step === 1 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#C8232C]/10 border border-[#C8232C]/20 flex items-center justify-center mb-5">
                <Building2 className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">What&apos;s your company called?</h2>
              <p className="text-sm text-muted mb-6">ExecOS will personalize everything around your business.</p>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                placeholder="Acme Corp"
                autoFocus
                className="w-full bg-surface border border-default rounded-lg px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-[#C8232C]/50 focus:ring-1 focus:ring-[#C8232C]/30 transition-colors text-base"
              />
            </div>
          )}

          {/* Step 2: Company profile */}
          {step === 2 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#C8232C]/10 border border-[#C8232C]/20 flex items-center justify-center mb-5">
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
                            ? "bg-[#C8232C]/15 border-[#C8232C]/50 text-brand"
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
                            ? "bg-[#C8232C]/15 border-[#C8232C]/50 text-brand"
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
                            ? "bg-[#C8232C]/15 border-[#C8232C]/50 text-brand"
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
              <div className="w-12 h-12 rounded-xl bg-[#C8232C]/10 border border-[#C8232C]/20 flex items-center justify-center mb-5">
                <Target className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">What are your top priorities?</h2>
              <p className="text-sm text-muted mb-6">Select all that apply. ExecOS will focus its intelligence here.</p>
              <div className="grid grid-cols-2 gap-2">
                {goals.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => toggleGoal(goal)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border text-left transition-all ${
                      form.selectedGoals.includes(goal)
                        ? "bg-[#C8232C]/15 border-[#C8232C]/50 text-brand"
                        : "border-default text-muted hover:border-strong hover:text-secondary"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        form.selectedGoals.includes(goal) ? "bg-[#C8232C]" : "bg-surface-raised"
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
              <div className="w-12 h-12 rounded-xl bg-[#C8232C]/10 border border-[#C8232C]/20 flex items-center justify-center mb-5">
                <Users className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">Last step — who are you?</h2>
              <p className="text-sm text-muted mb-6">
                ExecOS will personalize your executive experience.
              </p>
              <input
                type="text"
                value={form.ceoName}
                onChange={(e) => update("ceoName", e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full bg-surface border border-default rounded-lg px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-[#C8232C]/50 focus:ring-1 focus:ring-[#C8232C]/30 transition-colors text-base mb-4"
              />
              {form.ceoName && (
                <div className="bg-[#C8232C]/10 border border-[#C8232C]/20 rounded-xl p-4 fade-in">
                  <p className="text-sm text-secondary">
                    Welcome, <span className="text-primary font-semibold">{form.ceoName}</span>.
                    ExecOS is ready to activate for{" "}
                    <span className="text-primary font-semibold">{form.companyName}</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {error && <p className="text-xs text-red-400 mt-6">{error}</p>}
          <div className="flex items-center justify-between mt-8">
            <span className="text-xs text-muted">Step {step} of {totalSteps}</span>
            <button
              onClick={next}
              disabled={!canProceed() || submitting}
              className="flex items-center gap-2 bg-[#C8232C] hover:bg-[#A91D24] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
            >
              {submitting
                ? "Launching…"
                : step === totalSteps
                ? "Launch ExecOS"
                : "Continue"}
              {step === totalSteps ? <Activity className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
