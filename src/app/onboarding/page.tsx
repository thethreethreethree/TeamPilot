"use client";

import { Activity, ArrowRight, Building2, Users, Target, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

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

  const next = () => {
    if (step < totalSteps) setStep(step + 1);
    else router.push("/dashboard");
  };

  const canProceed = () => {
    if (step === 1) return form.companyName.trim().length > 0;
    if (step === 2) return form.industry && form.size && form.stage;
    if (step === 3) return form.selectedGoals.length > 0;
    if (step === 4) return form.ceoName.trim().length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-[#0c0d16] flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#5470ff]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center shadow-glow">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">ExecOS</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                i + 1 <= step ? "bg-[#5470ff]" : "bg-[#252840]"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="glass-card p-8 fade-in">
          {/* Step 1: Company name */}
          {step === 1 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#5470ff]/10 border border-[#5470ff]/20 flex items-center justify-center mb-5">
                <Building2 className="w-6 h-6 text-[#5470ff]" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">What&apos;s your company called?</h2>
              <p className="text-sm text-[#5a6399] mb-6">ExecOS will personalize everything around your business.</p>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                placeholder="Acme Corp"
                autoFocus
                className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-4 py-3 text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors text-base"
              />
            </div>
          )}

          {/* Step 2: Company profile */}
          {step === 2 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#5470ff]/10 border border-[#5470ff]/20 flex items-center justify-center mb-5">
                <Target className="w-6 h-6 text-[#5470ff]" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Tell us about {form.companyName}</h2>
              <p className="text-sm text-[#5a6399] mb-6">This helps the AI understand your operating context.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#8895c4] mb-2">Industry</label>
                  <div className="flex flex-wrap gap-2">
                    {industries.map((ind) => (
                      <button
                        key={ind}
                        onClick={() => update("industry", ind)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          form.industry === ind
                            ? "bg-[#5470ff]/15 border-[#5470ff]/50 text-[#7a96ff]"
                            : "border-[#252840] text-[#5a6399] hover:border-[#3a3f5c] hover:text-[#8895c4]"
                        }`}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8895c4] mb-2">Team size</label>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => update("size", s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          form.size === s
                            ? "bg-[#5470ff]/15 border-[#5470ff]/50 text-[#7a96ff]"
                            : "border-[#252840] text-[#5a6399] hover:border-[#3a3f5c] hover:text-[#8895c4]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8895c4] mb-2">Stage</label>
                  <div className="flex flex-wrap gap-2">
                    {stages.map((s) => (
                      <button
                        key={s}
                        onClick={() => update("stage", s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          form.stage === s
                            ? "bg-[#5470ff]/15 border-[#5470ff]/50 text-[#7a96ff]"
                            : "border-[#252840] text-[#5a6399] hover:border-[#3a3f5c] hover:text-[#8895c4]"
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
              <div className="w-12 h-12 rounded-xl bg-[#5470ff]/10 border border-[#5470ff]/20 flex items-center justify-center mb-5">
                <Target className="w-6 h-6 text-[#5470ff]" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">What are your top priorities?</h2>
              <p className="text-sm text-[#5a6399] mb-6">Select all that apply. ExecOS will focus its intelligence here.</p>
              <div className="grid grid-cols-2 gap-2">
                {goals.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => toggleGoal(goal)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border text-left transition-all ${
                      form.selectedGoals.includes(goal)
                        ? "bg-[#5470ff]/15 border-[#5470ff]/50 text-[#7a96ff]"
                        : "border-[#252840] text-[#5a6399] hover:border-[#3a3f5c] hover:text-[#8895c4]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        form.selectedGoals.includes(goal) ? "bg-[#5470ff]" : "bg-[#3a3f5c]"
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
              <div className="w-12 h-12 rounded-xl bg-[#5470ff]/10 border border-[#5470ff]/20 flex items-center justify-center mb-5">
                <Users className="w-6 h-6 text-[#5470ff]" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Last step — who are you?</h2>
              <p className="text-sm text-[#5a6399] mb-6">
                ExecOS will personalize your executive experience.
              </p>
              <input
                type="text"
                value={form.ceoName}
                onChange={(e) => update("ceoName", e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-4 py-3 text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors text-base mb-4"
              />
              {form.ceoName && (
                <div className="bg-[#5470ff]/10 border border-[#5470ff]/20 rounded-xl p-4 fade-in">
                  <p className="text-sm text-[#8895c4]">
                    Welcome, <span className="text-[#e8eaf6] font-semibold">{form.ceoName}</span>.
                    ExecOS is ready to activate for{" "}
                    <span className="text-[#e8eaf6] font-semibold">{form.companyName}</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-8">
            <span className="text-xs text-[#5a6399]">Step {step} of {totalSteps}</span>
            <button
              onClick={next}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
            >
              {step === totalSteps ? "Launch ExecOS" : "Continue"}
              {step === totalSteps ? <Activity className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
