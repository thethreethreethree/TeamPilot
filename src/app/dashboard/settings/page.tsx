"use client";

import TopBar from "@/components/layout/TopBar";
import { Field, Input, Select } from "@/components/ui/Field";
import { supabaseEnabled } from "@/lib/supabase/client";
import { useCompanyName } from "@/lib/hooks/useCompany";
import {
  AlertTriangle,
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
import { AvatarCustomizationPanel } from "@/components/settings/AvatarCustomizationPanel";

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

  // Editable copy
  const [draft, setDraft] = useState({
    name: "",
    industry: "",
    size: "",
    stage: "",
    timezone: "UTC",
    llm_provider_preference: "" as "" | "deepseek" | "anthropic",
  });

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
      setDraft({
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

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* LLM connection — renders in demo mode too, since the key
            doesn't depend on Supabase being configured. Lets the user
            verify provider connectivity before wiring anything else. */}
        <LlmConnectionPanel />

        {/* User-level avatar customization — color + initials shown on
            chat, tasks, notifications. Stores on profiles row via RLS. */}
        <AvatarCustomizationPanel />

        {/* In-app password rotation. Hidden in demo mode (no auth). */}
        <ChangePasswordPanel />

        {/* Conversational Coach v1.1 — company-wide toggle. Default
            OFF per asset A3; flipping it on activates the Coach
            across tasks, feedback, smoke test notes, and chat. */}
        <CoachTogglePanel />

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

            {/* Save */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted font-mono">
                Last saved:{" "}
                {settings.company.updated_at
                  ? settings.company.updated_at.slice(0, 19).replace("T", " ")
                  : "—"}
              </p>
              <button
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
