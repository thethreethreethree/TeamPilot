"use client";

import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { Field, Input, Select } from "@/components/ui/Field";
import { supabaseEnabled } from "@/lib/supabase/client";
import { useCompanyName } from "@/lib/hooks/useCompany";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Cpu,
  Globe,
  Loader2,
  Save,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { LlmConnectionPanel } from "@/components/settings/LlmConnectionPanel";
import { ChangePasswordPanel } from "@/components/settings/ChangePasswordPanel";
import { CoachTogglePanel } from "@/components/settings/CoachTogglePanel";
import { LearningModePanel } from "@/components/settings/LearningModePanel";
import { ExperienceModePanel } from "@/components/settings/ExperienceModePanel";
import { AvatarCustomizationPanel } from "@/components/settings/AvatarCustomizationPanel";
import { ProfilePanel } from "@/components/settings/ProfilePanel";

interface Settings {
  company: {
    id: string;
    name: string;
    industry: string | null;
    size: string | null;
    stage: string | null;
    goals: string[] | null;
    timezone: string;
    llm_provider_preference: "deepseek" | "anthropic" | null;
    ai_guidance_enabled: boolean;
    ai_guidance_unlock_at: string | null;
    ai_guidance_enabled_at: string | null;
    updated_at: string;
  };
  llm: {
    preference: "deepseek" | "anthropic" | null;
    activeProvider: string | null;
    activeReason: string;
  };
}

export default function SettingsPage() {
  useCompanyName(); // Pre-warms the hook cache used by the sidebar.
  const toast = useToast();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Editable copy. Any setter call also clears the "Saved" stamp
  // so the button reverts to "Save changes" the moment the user
  // modifies anything — the old behavior left the Saved state
  // visible after a fresh edit, which suggested nothing was
  // pending when there was. Wrap below.
  const [draft, setDraftInternal] = useState({
    name: "",
    industry: "",
    size: "",
    stage: "",
    timezone: "UTC",
    llm_provider_preference: "" as "" | "deepseek" | "anthropic",
  });
  /** Wrap setDraft so any edit clears the post-save 'Saved'
   *  badge. Without this, the badge stays on screen even after
   *  the user starts a new edit, suggesting nothing is pending. */
  const setDraft: React.Dispatch<
    React.SetStateAction<{
      name: string;
      industry: string;
      size: string;
      stage: string;
      timezone: string;
      llm_provider_preference: "" | "deepseek" | "anthropic";
    }>
  > = (next) => {
    setDraftInternal(next);
    setSavedAt(null);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to load.");
      }
      const data = (await res.json()) as Settings;
      setSettings(data);
      // Use the raw setter here so we don't clear savedAt after
      // a successful save (which calls load() to refresh).
      setDraftInternal({
        name: data.company.name ?? "",
        industry: data.company.industry ?? "",
        size: data.company.size ?? "",
        stage: data.company.stage ?? "",
        timezone: data.company.timezone ?? "UTC",
        llm_provider_preference: data.company.llm_provider_preference ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: draft.name || null,
        industry: draft.industry || null,
        size: draft.size || null,
        stage: draft.stage || null,
        timezone: draft.timezone || "UTC",
        llm_provider_preference: draft.llm_provider_preference || null,
      };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSavedAt(new Date());
      toast.success("Settings saved");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast.error("Settings not saved", msg);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (supabaseEnabled) load();
    else setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Settings" subtitle="Company + AI configuration" />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <LearningHint
          as="block"
          category="Settings · AI"
          title="LLM connection"
          whatItIs="The AI provider configuration panel. Lets the team verify which LLM provider is active (DeepSeek primary by default; Anthropic alternate), confirm the API key is connected, and send a test ping. Reports the model used, response latency, and token usage. Rate-limited to 6 pings per minute."
          why="The AI is doing real work on this tenant — drafting Coach replies, composing Decision Dialogue responses, reading customer messages. Before the team trusts any of that output, they need a structural way to verify the provider is responding and the key is alive. Without this surface, an expired key would silently degrade every AI feature with no obvious signal."
          how="Land on Settings, see which provider is active (green ACTIVE tag), confirm key status (green dot if configured). Hit Run test — within a few seconds you should see model, latency, and a sample of the response. If latency is climbing or the test fails, that's actionable signal before users feel it."
          principle="Trust the AI surface only when you've verified the AI is actually there. The Run test button is the structural verification."
        >
          {/* LLM connection — renders in demo mode too, since the key
              doesn't depend on Supabase being configured. Lets the user
              verify provider connectivity before wiring anything else. */}
          <LlmConnectionPanel />
        </LearningHint>

        <LearningHint
          as="block"
          category="Settings · Org"
          title="Departments"
          whatItIs="The org-chart units within your company. Pillar 1 of the §A6 asset classification triad — every classified file belongs to one or more departments. Admin-managed (CEO / COO / admin) at /dashboard/settings/departments: create, rename, archive, assign users."
          why="Without real departments, the asset classification gate is theater — files get tagged with made-up labels and the search later doesn't help anyone. Real org-chart units make the gate honest and the retrieval valuable."
          how="Click Manage departments. Add a department for each function the team actually has (Engineering, Customer Success, Operations, etc.). Add a short description so the AI classifier can read department semantics."
          principle="The org chart is the search index. Honest names + honest descriptions = the team finding what it built."
        >
          <div className="rounded-lg border border-default p-4 bg-white/[0.01] flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand" aria-hidden />
                Departments
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                Org-chart units used by the asset classification gate and the auto-folder navigation.
              </p>
            </div>
            <Link
              href="/dashboard/settings/departments"
              className="text-xs font-semibold text-brand border border-ember-400/40 hover:border-ember-400/70 bg-ember-400/5 hover:bg-ember-400/10 px-3 py-1.5 rounded-md flex-shrink-0"
            >
              Manage departments →
            </Link>
          </div>
        </LearningHint>

        {/* Edit your own name (+ view sign-in email). Fills the account gap:
            full_name was set only at onboarding with no later edit surface. */}
        <ProfilePanel />

        <LearningHint
          as="block"
          category="Settings · Profile"
          title="Avatar"
          whatItIs="Personal avatar customization — color + initials shown on your messages across chat, tasks, decisions, and notifications. Defaults to derived initials (first letter of first + last name) and the brand ember color. You can override either; both stored on your profile row."
          why="Recognition matters in fast-scrolling conversation surfaces. When the team can tell at a glance which messages are yours, comprehension speeds up materially. The customization here is small but the daily compound benefit is real."
          how="Pick a color from the swatch row or type a hex value. Set initials (1–3 chars). Save. The next message you send carries the new avatar; existing messages re-render with the new color too."
          principle="Small recognition affordances compound. Spend 30 seconds here once; reap the benefit every conversation."
        >
          {/* User-level avatar customization — color + initials shown on
              chat, tasks, notifications. Stores on profiles row via RLS. */}
          <AvatarCustomizationPanel />
        </LearningHint>

        <LearningHint
          as="block"
          category="Settings · Security"
          title="Change password"
          whatItIs="In-app password rotation. Sets a new password on your auth row, takes effect immediately. You stay signed in on this device; other devices stay signed in too until you sign them out. Hidden in demo mode (no auth there)."
          why="Periodic password rotation is the cheapest security hygiene. The point of having a rotate-in-app affordance (rather than 'email a reset link') is that the user is already authenticated — there's no roundtrip through email or SMS — so rotation friction is low enough that the team actually does it."
          how="Enter your new password (≥8 chars, autocomplete=new-password so your password manager picks it up). Confirm. Save. Done — no sign-out needed."
          principle="Security hygiene is what you do regularly. The affordance is here because friction kills the habit."
        >
          {/* In-app password rotation. Hidden in demo mode (no auth). */}
          <ChangePasswordPanel />
        </LearningHint>

        <LearningHint
          as="block"
          category="Settings · Coach"
          title="Coach company-wide toggle"
          whatItIs="The master switch for Conversational Coach v5 across the whole tenant. When ON, the Coach lens activates on every message draft — chat, tasks, feedback, smoke-test notes. When OFF, individual topics can still flip Coach on per-topic. Default OFF per §A3 so the §4 readout has a clean A/B baseline between Coach-on and Coach-off cohorts."
          why="The default-OFF is constitutional. The §4 readout's whole purpose is to measure whether Coach changes outcomes — that comparison is only possible if some teams have it on and some have it off. Once you flip this ON, your tenant becomes a Coach-on cohort permanently; future readout comparisons can still happen at the per-topic level."
          how="Flip ON when the team has agreed to operate with Coach guidance on every draft. Flip OFF if Coach feedback is producing more noise than signal for your team's style. The switch records a chain event each direction so the audit trail is intact."
          principle="Coach default OFF is a constitutional choice, not a UX oversight. Flipping it is a real commitment."
        >
          {/* Conversational Coach v1.1 — company-wide toggle. Default
              OFF per asset A3; flipping it on activates the Coach
              across tasks, feedback, smoke test notes, and chat. */}
          <CoachTogglePanel />
        </LearningHint>

        {/* Learning Mode — per-user toggle. Activates the lightbulb
            FAB on every dashboard page so the user can illuminate
            the interface and see what each feature does. Dark-mode
            only per the brand metaphor; enabling auto-switches the
            theme. */}
        <LearningModePanel />

        {/* Experience Mode — the Standard/Expert complexity dial (0110). */}
        <ExperienceModePanel />

        {!supabaseEnabled && (
          <div className="glass-card p-6 text-center">
            <AlertTriangle className="w-5 h-5 text-yellow-300 mx-auto mb-2" />
            <p className="text-sm text-primary mb-1">
              Company profile requires live mode
            </p>
            <p className="text-xs text-muted max-w-md mx-auto">
              Company-level settings live on the database row. Configure Supabase to
              edit them. (The LLM panel above works regardless.)
            </p>
          </div>
        )}

        {supabaseEnabled && loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        )}

        {supabaseEnabled && !loading && error && (
          <div className="glass-card p-4 border-red-500/30">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {settings && (
          <>
            {/* Company profile */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-primary">Company profile</h2>
              </div>
              <p className="text-xs text-muted mb-5">
                Used by the brain (AMD-003) as background context for every LLM call. Honest
                values make the per-company memory more accurate over time.
              </p>
              <div className="space-y-4">
                <Field label="Company name">
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Acme Corp"
                  />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Industry">
                    <Input
                      value={draft.industry}
                      onChange={(e) =>
                        setDraft({ ...draft, industry: e.target.value })
                      }
                      placeholder="SaaS, Manufacturing, …"
                    />
                  </Field>
                  <Field label="Stage">
                    <Input
                      value={draft.stage}
                      onChange={(e) => setDraft({ ...draft, stage: e.target.value })}
                      placeholder="Early, Growth, Scale"
                    />
                  </Field>
                  <Field label="Team size">
                    <Input
                      value={draft.size}
                      onChange={(e) => setDraft({ ...draft, size: e.target.value })}
                      placeholder="1-10, 11-50, …"
                    />
                  </Field>
                  <Field label="Timezone">
                    <Input
                      value={draft.timezone}
                      onChange={(e) =>
                        setDraft({ ...draft, timezone: e.target.value })
                      }
                      placeholder="UTC, America/Los_Angeles, …"
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* AI provider configuration */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-primary">LLM provider</h2>
              </div>
              <p className="text-xs text-muted mb-5">
                Per AMD-003: DeepSeek is the default. Anthropic is kept as a configurable
                alternate. You can pin a preference here; if the preferred provider has
                no API key configured, the system falls back to whichever has a key set.
              </p>

              <div
                className={`p-3 rounded-xl border mb-4 ${
                  settings.llm.activeProvider
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-yellow-500/5 border-yellow-500/20"
                }`}
              >
                <p
                  className={`text-[10px] uppercase tracking-widest mb-1 ${
                    settings.llm.activeProvider
                      ? "text-emerald-300"
                      : "text-yellow-300"
                  }`}
                >
                  active provider
                </p>
                <p className="text-sm text-primary">
                  {settings.llm.activeProvider ?? "none"} —{" "}
                  <span className="text-secondary">{settings.llm.activeReason}</span>
                </p>
              </div>

              <Field label="Preferred provider for this company">
                <Select
                  value={draft.llm_provider_preference}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      llm_provider_preference: e.target.value as
                        | ""
                        | "deepseek"
                        | "anthropic",
                    })
                  }
                >
                  <option value="">(use env default — DeepSeek if available)</option>
                  <option value="deepseek">DeepSeek (primary per AMD-003)</option>
                  <option value="anthropic">Anthropic (alternate)</option>
                </Select>
              </Field>
              <p className="text-[10px] text-muted mt-2 leading-relaxed">
                API keys live in <code className="text-brand">.env.local</code> or in
                your deployment&apos;s environment — they are never stored in the database.
                Set <code className="text-brand">DEEPSEEK_API_KEY</code> (primary) or{" "}
                <code className="text-brand">ANTHROPIC_API_KEY</code> (alternate).
              </p>
            </div>

            {/* AI guidance control window */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-primary">
                  §3.4 control window
                </h2>
              </div>
              <p className="text-xs text-muted mb-4">
                AI guidance is suppressed for the first 30 days so the team&apos;s
                baseline can be captured honestly. Manage from <a className="text-brand underline" href="/dashboard/brain">Company Brain</a>.
              </p>
              <p className="text-xs text-primary">
                Status:{" "}
                <span
                  className={
                    settings.company.ai_guidance_enabled
                      ? "text-emerald-300"
                      : "text-yellow-300"
                  }
                >
                  {settings.company.ai_guidance_enabled ? "enabled" : "suppressed"}
                </span>
                {settings.company.ai_guidance_unlock_at && (
                  <>
                    {" "}
                    · auto-unlock{" "}
                    <span className="font-mono">
                      {settings.company.ai_guidance_unlock_at.slice(0, 10)}
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Save — sticky-bottom on mobile so the action stays
                reachable as the user scrolls through long settings.
                md+ goes back to inline so the layout doesn't shift
                on desktop. */}
            <div
              role="status"
              aria-live="polite"
              className="sticky bottom-0 -mx-6 px-6 py-3 bg-base/95 backdrop-blur-sm border-t border-default md:static md:bg-transparent md:backdrop-blur-0 md:border-t-0 md:p-0 flex items-center justify-between gap-3 mb-[env(safe-area-inset-bottom)] md:mb-0"
            >
              <p className="text-[10px] text-muted font-mono">
                Last saved:{" "}
                {settings.company.updated_at
                  ? settings.company.updated_at.slice(0, 19).replace("T", " ")
                  : "—"}
              </p>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-5 py-2.5 rounded-lg transition-all text-xs"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : savedAt ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saving ? "Saving…" : savedAt ? "Saved" : "Save changes"}
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
