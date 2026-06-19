"use client";

import {
  Activity,
  Building2,
  ChevronRight,
  Mail,
  Plus,
  Sparkles,
  Target,
  Users,
  X,
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
    // Step 6 — team invites captured during onboarding so the
    // team can join without the founder hunting for the invite
    // UI later. ELOSTATE-wide value: every module (Chats, Tasks,
    // Decisions, Care, etc.) benefits from the team being on it.
    // Per TT.md A4: empty list is valid (founder may not have
    // emails ready or may want to onboard solo first).
    teamInvites: [] as Array<{ email: string; role: string }>,
  });

  const totalSteps = 6;

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Invite-row management helpers — small array editing pattern.
  const addInviteRow = () =>
    setForm((prev) => ({
      ...prev,
      teamInvites: [...prev.teamInvites, { email: "", role: "Member" }],
    }));
  const updateInviteRow = (
    idx: number,
    patch: { email?: string; role?: string }
  ) =>
    setForm((prev) => ({
      ...prev,
      teamInvites: prev.teamInvites.map((r, i) =>
        i === idx ? { ...r, ...patch } : r
      ),
    }));
  const removeInviteRow = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      teamInvites: prev.teamInvites.filter((_, i) => i !== idx),
    }));

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

      // Team invites are created AFTER the onboarding RPC commits
      // so the caller's profile.company_id is set when the
      // /api/team handler reads it via getCurrentCompanyId().
      // Per TT.md A14 (multi-state render): individual invite
      // failures don't roll back the onboarding — the company
      // exists, the founder is signed in. We surface the failed
      // emails and the founder can re-invite from /dashboard/team.
      const validInvites = form.teamInvites
        .map((r) => ({
          email: r.email.trim().toLowerCase(),
          role: r.role,
        }))
        .filter((r) => r.email.length > 0 && r.email.includes("@"));
      const failedEmails: string[] = [];
      if (validInvites.length > 0) {
        // Sequential, not parallel: the POST /api/team handler has
        // duplicate-prevention checks that hit the same row, and
        // parallel inserts could race the existence check. The
        // wizard's typical batch is small (3-5 invites) so the
        // sequential cost is negligible.
        for (const invite of validInvites) {
          try {
            const inviteRes = await fetch("/api/team", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(invite),
            });
            // Audit finding: the previous try/catch only caught
            // network errors. fetch() resolves successfully for
            // 4xx responses (e.g. 409 duplicate email), so a
            // failed invite was silently treated as success.
            // Per the existing A14 comment we DO NOT claim
            // success we didn't deliver — now we track failures
            // and surface them.
            if (!inviteRes.ok) {
              failedEmails.push(invite.email);
            }
          } catch {
            failedEmails.push(invite.email);
          }
        }
      }

      // Surface failed invites via URL params so /dashboard/team
      // can show the founder which ones didn't land and offer
      // retry. Without this, the wizard would say "Launched"
      // and the founder would have no visibility into the
      // partial failure.
      if (failedEmails.length > 0) {
        const qs = new URLSearchParams({
          inviteFailed: failedEmails.join(","),
        }).toString();
        router.push(`/dashboard/team?${qs}`);
      } else {
        router.push("/dashboard");
      }
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
    // Step 6 (team invites) — always proceedable. Empty list is
    // valid; the founder may want to onboard solo first.
    if (step === 6) return true;
    return true;
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-ember-400/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ember-400 to-[#FDE047] flex items-center justify-center shadow-glow">
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
                i + 1 <= step ? "bg-ember-400" : "bg-surface-raised"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="glass-card p-8 fade-in">
          {/* Step 1: Company name */}
          {step === 1 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-ember-400/10 border border-ember-400/20 flex items-center justify-center mb-5">
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
                className="w-full bg-surface border border-default rounded-lg px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors text-base"
              />
            </div>
          )}

          {/* Step 2: Company profile */}
          {step === 2 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-ember-400/10 border border-ember-400/20 flex items-center justify-center mb-5">
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
                        type="button"
                        onClick={() => update("industry", ind)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          form.industry === ind
                            ? "bg-ember-400/15 border-ember-400/50 text-brand"
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
                        type="button"
                        onClick={() => update("size", s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          form.size === s
                            ? "bg-ember-400/15 border-ember-400/50 text-brand"
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
                        type="button"
                        onClick={() => update("stage", s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          form.stage === s
                            ? "bg-ember-400/15 border-ember-400/50 text-brand"
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
              <div className="w-12 h-12 rounded-xl bg-ember-400/10 border border-ember-400/20 flex items-center justify-center mb-5">
                <Target className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">What are your top priorities?</h2>
              <p className="text-sm text-muted mb-6">Select all that apply. ELOSTATE will focus its intelligence here.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {goals.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggleGoal(goal)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border text-left transition-all ${
                      form.selectedGoals.includes(goal)
                        ? "bg-ember-400/15 border-ember-400/50 text-brand"
                        : "border-default text-muted hover:border-strong hover:text-secondary"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        form.selectedGoals.includes(goal) ? "bg-ember-400" : "bg-surface-raised"
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
              <div className="w-12 h-12 rounded-xl bg-ember-400/10 border border-ember-400/20 flex items-center justify-center mb-5">
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
                className="w-full bg-surface border border-default rounded-lg px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors text-base mb-4"
              />
              {form.ceoName && (
                <div className="bg-ember-400/10 border border-ember-400/20 rounded-xl p-4 fade-in">
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
              <div className="w-12 h-12 rounded-xl bg-ember-400/10 border border-ember-400/20 flex items-center justify-center mb-5">
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
                // Smaller default on mobile (5) — 8 rows pushes
                // the Next button below the keyboard on iPhone SE.
                // Desktop keeps 8 via md:rows-* (handled by min-height
                // utility class on the textarea container instead,
                // since rows= can't be responsive). Keep rows=5 +
                // min-h via class.
                rows={5}
                placeholder={`What ${form.companyName || "your business"} actually does:
[one sentence — the product in plain terms]

Features customers will ask about (use these names when answering):
- [Feature 1] — [one sentence: what it does]
- [Feature 2] — [...]

Pricing & access:
[what plans you offer / how customers sign up]

Always hand off to a human for:
[account-specific data, billing, refunds, anything sensitive]`}
                className="w-full min-h-[10rem] md:min-h-[14rem] bg-surface border border-default rounded-lg px-3.5 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-y leading-relaxed font-mono"
              />
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                Listing features by name makes &quot;yes, we have that&quot;
                the AI&apos;s safe default for things you actually offer.
                Anything you don&apos;t name, the AI will hand off rather
                than guess.
              </p>
            </div>
          )}

          {/* Step 6: Team invites (optional). Per AMD-006 layer 3
              (composition): every ELOSTATE module (Chats, Tasks,
              Decisions, Care, etc.) gets value from the team
              being on it — capturing invites here means the team
              joins without the founder hunting for the invite UI
              after onboarding.

              TT.md A4: empty list is valid (founder may onboard
              solo first). A18 label invites: copy invites
              "bring your team" not "configure permissions". */}
          {step === 6 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-ember-400/10 border border-ember-400/20 flex items-center justify-center mb-5">
                <Mail className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">
                Bring your team in
              </h2>
              <p className="text-sm text-muted mb-5">
                We&apos;ll create invites you can share. Add as many as
                you want now — skip if you&apos;d rather onboard solo
                first.
              </p>

              <div className="space-y-2 mb-3">
                {form.teamInvites.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={row.email}
                      onChange={(e) =>
                        updateInviteRow(idx, { email: e.target.value })
                      }
                      placeholder="teammate@company.com"
                      className="flex-1 bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors"
                    />
                    <select
                      value={row.role}
                      onChange={(e) =>
                        updateInviteRow(idx, { role: e.target.value })
                      }
                      className="bg-surface border border-default rounded-lg px-2 py-2 text-xs text-primary focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30"
                    >
                      <option value="Member">Member</option>
                      <option value="Lead">Lead</option>
                      <option value="COO">COO</option>
                      <option value="CEO">CEO</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeInviteRow(idx)}
                      aria-label="Remove invite"
                      className="text-muted hover:text-red-300 p-1.5 rounded hover:bg-red-500/10 transition-colors"
                    >
                      <X className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addInviteRow}
                className="inline-flex items-center gap-1.5 text-xs text-brand border border-ember-400/40 hover:border-ember-400/70 px-3 py-1.5 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden />
                {form.teamInvites.length === 0
                  ? "Add a teammate"
                  : "Add another"}
              </button>

              {form.teamInvites.length > 0 && (
                <p className="text-[11px] text-muted mt-3 leading-relaxed">
                  Invite links land in{" "}
                  <span className="text-secondary font-medium">
                    Team → Pending invitations
                  </span>{" "}
                  after launch — you can copy and share them then.
                </p>
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
              className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 disabled:cursor-not-allowed text-[#09090B] font-semibold px-6 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
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
