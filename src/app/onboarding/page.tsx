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
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { LearningHint } from "@/components/learning/LearningHint";

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
  // Synchronous latches: onboarding create/join both write once and then
  // navigate away, so a double-click race (before the disabled button re-
  // renders) must not fire the RPC/route twice — a second complete_company_
  // onboarding call would create a SECOND company and re-point the profile,
  // orphaning the first tenant on the user's very first action.
  const submittingRef = useRef(false);
  const joiningRef = useRef(false);
  const [error, setError] = useState("");
  // F5 (audit 2026-07-10): a user who signed up WITHOUT an invite link lands here
  // with no company and can only create one — a dead end if they were meant to JOIN
  // an existing company. This path lets them enter an invite code instead. Safe now
  // that 0114 (email-match) is applied: accept_invitation verifies the code was sent
  // to THIS user's email before attaching them.
  const [joinMode, setJoinMode] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code || joiningRef.current) return;
    joiningRef.current = true;
    setJoining(true);
    setJoinError("");
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't join with that code.");
      router.push("/dashboard");
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Couldn't join with that code."
      );
    } finally {
      joiningRef.current = false;
      setJoining(false);
    }
  };
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
    if (submittingRef.current) return;
    submittingRef.current = true;
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
      submittingRef.current = false;
      setSubmitting(false);
    }
    // On success we router.push away and unmount, so the latch intentionally
    // stays set — the create must not be re-fireable after it succeeds.
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
              <LearningHint
                as="block"
                category="Onboarding · Company"
                title="Your company name"
                whatItIs="The name of the organization this ELOSTATE workspace belongs to. It creates the company record everything else attaches to."
                why="ELOSTATE has no generic mode — its behavior is derived per-company from your team's own data. This is the first stone of that: the container that your events, people, and problems accumulate inside."
                how="Enter the name your team knows the business by. You can refine details on the next steps."
                principle="The system is built around your company specifically, never a one-size template."
              >
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                placeholder="Acme Corp"
                autoFocus
                className="w-full bg-surface border border-default rounded-lg px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors text-base"
              />
              </LearningHint>

              {/* F5 (audit 2026-07-10): join-existing alternative so a user who
                  signed up without an invite link isn't dead-ended at create-only. */}
              <div className="mt-6 pt-5 border-t border-default">
                {!joinMode ? (
                  <button
                    type="button"
                    onClick={() => setJoinMode(true)}
                    className="text-xs text-muted hover:text-secondary transition-colors"
                  >
                    Already invited to a company?{" "}
                    <span className="text-brand">Join with an invite code →</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-secondary">
                      Paste the invite code your admin sent you — you&apos;ll join
                      their company instead of creating a new one.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleJoin();
                        }}
                        placeholder="Invite code"
                        className="flex-1 bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => void handleJoin()}
                        disabled={joining || !joinCode.trim()}
                        className="px-4 py-2 rounded-lg bg-ember-400/15 border border-ember-400/40 text-sm text-brand font-medium disabled:opacity-50 hover:bg-ember-400/20 transition-colors"
                      >
                        {joining ? "Joining…" : "Join"}
                      </button>
                    </div>
                    {joinError && (
                      <p className="text-xs text-red-300">{joinError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setJoinMode(false);
                        setJoinError("");
                      }}
                      className="text-[11px] text-muted hover:text-secondary"
                    >
                      ← Back to creating a company
                    </button>
                  </div>
                )}
              </div>
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
                <LearningHint
                  as="block"
                  category="Onboarding · Context"
                  title="Industry"
                  whatItIs="The sector your business operates in, picked from a short list."
                  why="Context is what lets the system reason about your situation rather than a generic one. Industry shapes what 'normal' looks like — a healthcare team and a SaaS team hit different bottlenecks."
                  how="Pick the closest match. 'Other' is a legitimate choice if none fit — an honest 'other' beats a forced wrong label."
                  principle="Better context in means better-grounded reasoning out."
                >
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
                </LearningHint>

                <LearningHint
                  as="block"
                  category="Onboarding · Context"
                  title="Team size"
                  whatItIs="The rough headcount of your organization."
                  why="Scale changes what a bottleneck even is. A ten-person team's coordination problem is a different animal from a five-hundred-person one, and the system calibrates to that."
                  how="Pick the band you're in. It's a starting calibration, not a hard boundary — the system keeps learning your actual shape from real activity."
                  principle="Size is context, not a verdict — it tunes the lens, it doesn't rank you."
                >
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
                </LearningHint>

                <LearningHint
                  as="block"
                  category="Onboarding · Context"
                  title="Stage"
                  whatItIs="Where your business is in its lifecycle, from pre-revenue to enterprise."
                  why="Stage sets the stakes and the tempo. A pre-revenue team's problems are about finding the path; an enterprise team's are about execution at scale. The same symptom means different things at different stages."
                  how="Choose the stage that describes you today. As your reality changes, the system adapts from the data — this is just the opening read."
                  principle="Nothing here is static — the system stays adaptive because your context isn't frozen."
                >
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
                </LearningHint>
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
              <LearningHint
                as="block"
                category="Onboarding · Priorities"
                title="Your top priorities"
                whatItIs="The outcomes you most want ELOSTATE working on — select as many as apply."
                why="Priorities point the system's attention. They tell it which bottlenecks matter to you, so the problems it surfaces are the ones you'd actually act on rather than noise."
                how="Pick everything that genuinely matters now. Don't over-select to be safe — a focused list gives sharper focus than an everything list."
                principle="Direction beats breadth — what you point at is what gets diagnosed first."
              >
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
              </LearningHint>
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
              <LearningHint
                as="block"
                category="Onboarding · You"
                title="Your name"
                whatItIs="The name of the person setting this up — you, the founder or lead. It personalizes your executive view and marks you on the company record."
                why="The system distinguishes who is doing what, and the person who creates the company is the anchor account. Naming yourself here makes your own activity legible in the views you'll live in."
                how="Enter your real name. This is you specifically, not a role label — teammates you invite will name themselves when they join."
                principle="A record of who-did-what is only useful when 'who' is a real, named person."
              >
              <input
                type="text"
                value={form.ceoName}
                onChange={(e) => update("ceoName", e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full bg-surface border border-default rounded-lg px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors text-base mb-4"
              />
              </LearningHint>
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
              <LearningHint
                as="block"
                category="Onboarding · Product context"
                title="What your business offers"
                whatItIs="A few plain sentences describing your product that your customer-facing AI can ground its answers in."
                why="Without this, the AI honestly won't pretend to know your product — it hands every question off to a human. With it, the AI can answer accurately about what you actually offer instead of guessing."
                how="Name the features customers ask about and what to always hand off. Skip it if you don't have polished copy yet — an empty value is a valid choice, and the AI stays safe by handing off until you fill it."
                principle="The system would rather hand off than fabricate — honesty about what it doesn't know is the feature, not a gap."
              >
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
              </LearningHint>
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

              <LearningHint
                as="inline-block"
                category="Onboarding · Team"
                title="Add a teammate"
                whatItIs="Adds an invite row where you enter a teammate's email and role. ELOSTATE creates a shareable invite link for each after launch."
                why="Every module gets more useful once the team is on it — the record is only complete when the people generating the work are in the system. Capturing invites now spares you hunting for the invite UI later."
                how="Add as many as you like, set each person's role, or skip entirely. Onboarding solo first is fine — you can invite anyone from Team later. Invite links appear under Team once you launch."
                principle="The system reflects the whole team, so bringing the team in is where its value compounds."
              >
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
              </LearningHint>

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
            <LearningHint
              as="inline-block"
              category="Onboarding · Progress"
              title={step === totalSteps ? "Launch ELOSTATE" : "Continue"}
              whatItIs="Advances to the next setup step, or — on the final step — commits everything and activates ELOSTATE for your company."
              why="Launch writes your company, profile, and any invites in a single transaction, so a mid-setup network blip rolls back cleanly instead of leaving you a half-created workspace you can't get into."
              how="It stays disabled until the current step's required fields are filled, so you can't skip past something the setup needs. On the last step it reads 'Launch' — that's the commit."
              principle="Setup either completes whole or not at all — never a stranded half-state."
            >
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
            </LearningHint>
          </div>
        </div>
      </div>
    </div>
  );
}
