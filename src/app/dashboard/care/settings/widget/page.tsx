"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Save, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SettingsTabs } from "@/components/care/SettingsTabs";

/**
 * /dashboard/care/settings/widget
 *
 * The white-label control surface. Company admins (CEO/COO/admin)
 * configure how the embedded widget looks and behaves on their
 * customers' sites:
 *   - Embed snippet (copyable)
 *   - Allowed origins (CORS whitelist enforced at the server)
 *   - Widget appearance (color, greeting, subtitle, position)
 *   - Branding (display name, logo, reply signature)
 *   - AI personality (product context, tone, response length)
 *   - Active toggle
 *
 * Embed token is read-only here for safety — rotating it is a
 * separate explicit action so it can't happen by accident.
 */

type TenantConfig = {
  company_id: string;
  embed_token: string;
  allowed_origins: string[];
  active: boolean;
  widget_color: string;
  widget_greeting: string;
  widget_subtitle: string;
  widget_position: "bottom-right" | "bottom-left";
  widget_logo_url: string | null;
  company_display_name: string | null;
  reply_signature: string | null;
  ai_product_context: string | null;
  ai_tone: "warm" | "formal" | "casual" | "direct";
  ai_response_length: "short" | "medium" | "long";
  plan: string;
  monthly_conversation_quota: number;
};

export default function CareWidgetSettingsPage() {
  const toast = useToast();
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [draft, setDraft] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originsRaw, setOriginsRaw] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/care/agent/tenant");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setDraft(data.config);
        setOriginsRaw((data.config.allowed_origins ?? []).join("\n"));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const allowedOrigins = originsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/care/agent/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedOrigins,
          active: draft.active,
          widgetColor: draft.widget_color,
          widgetGreeting: draft.widget_greeting,
          widgetSubtitle: draft.widget_subtitle,
          widgetPosition: draft.widget_position,
          widgetLogoUrl: draft.widget_logo_url,
          companyDisplayName: draft.company_display_name,
          replySignature: draft.reply_signature,
          aiProductContext: draft.ai_product_context,
          aiTone: draft.ai_tone,
          aiResponseLength: draft.ai_response_length,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setDraft(data.config);
        toast.success("Saved", "Widget config updated.");
      } else {
        toast.error("Couldn't save.");
      }
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied", label);
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  if (loading || !config || !draft) {
    return (
      <>
        <header className="px-8 py-4 border-b border-default bg-base/60">
          <h1 className="text-lg font-semibold text-primary">Settings</h1>
          <p className="text-[11px] text-muted">Widget</p>
        </header>
        <SettingsTabs />
        <div className="flex items-center gap-2 text-xs text-muted py-16 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </div>
      </>
    );
  }

  const snippet = `<script src="https://elostate.com/care-widget.js" data-token="${config.embed_token}"></script>`;

  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">Settings</h1>
          <p className="text-[11px] text-muted">
            Widget · embed C.A.R.E on your site
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-50 text-[#09090B] px-3 py-1.5 rounded-md"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" aria-hidden />
          )}
          Save changes
        </button>
      </header>
      <SettingsTabs />
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {/* Active toggle */}
        <Section title="Status">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary">
                Widget is{" "}
                <span
                  className={
                    draft.active ? "text-emerald-300 font-semibold" : "text-muted"
                  }
                >
                  {draft.active ? "live" : "paused"}
                </span>
              </p>
              <p className="text-[11px] text-muted">
                When paused, embedded sites will see a friendly &quot;paused&quot; message
                instead of the chat bubble.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                className="accent-[#FACC15]"
              />
              Active
            </label>
          </div>
        </Section>

        {/* Embed snippet */}
        <Section title="Embed snippet" subtitle="Drop this in the <head> of your site.">
          <div className="relative">
            <pre className="bg-base border border-default rounded-md p-3 text-xs text-primary font-mono overflow-x-auto pr-20">
              {snippet}
            </pre>
            <button
              type="button"
              onClick={() => void copy(snippet, "Snippet on your clipboard.")}
              className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-brand bg-[#FACC15]/10 border border-[#FACC15]/40 hover:border-[#FACC15]/70 px-2 py-1 rounded-md"
            >
              <Copy className="w-3 h-3" aria-hidden />
              Copy
            </button>
          </div>
          <p className="text-[11px] text-muted mt-2">
            The token in this snippet identifies your tenant. Keep it
            on the sites listed under &quot;Allowed origins&quot; below
            — requests from any other origin are rejected.
          </p>
        </Section>

        {/* Allowed origins */}
        <Section
          title="Allowed origins"
          subtitle="One per line. Only these origins are allowed to load and chat through your widget."
        >
          <textarea
            value={originsRaw}
            onChange={(e) => setOriginsRaw(e.target.value)}
            rows={4}
            placeholder={"https://yourbusiness.com\nhttps://www.yourbusiness.com"}
            className="w-full bg-base border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y font-mono"
          />
          <p className="text-[11px] text-muted mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-brand" aria-hidden />
            Origin mismatch attempts are logged. Visible to you at
            /dashboard/care/settings/widget &gt; load events (Sprint 7).
          </p>
        </Section>

        {/* Appearance */}
        <Section title="Appearance" subtitle="How the widget looks on your site.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              label="Greeting"
              value={draft.widget_greeting}
              onChange={(v) => setDraft({ ...draft, widget_greeting: v })}
            />
            <Field
              label="Subtitle"
              value={draft.widget_subtitle}
              onChange={(v) => setDraft({ ...draft, widget_subtitle: v })}
            />
            <Field
              label="Primary color (hex)"
              value={draft.widget_color}
              onChange={(v) => setDraft({ ...draft, widget_color: v })}
              mono
            />
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                Position
              </label>
              <select
                value={draft.widget_position}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    widget_position: e.target
                      .value as TenantConfig["widget_position"],
                  })
                }
                className="w-full bg-base border border-default rounded-md px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
              >
                <option value="bottom-right">Bottom-right</option>
                <option value="bottom-left">Bottom-left</option>
              </select>
            </div>
            <Field
              label="Logo URL (optional)"
              value={draft.widget_logo_url ?? ""}
              onChange={(v) =>
                setDraft({ ...draft, widget_logo_url: v || null })
              }
            />
            <Field
              label="Display name"
              value={draft.company_display_name ?? ""}
              onChange={(v) =>
                setDraft({ ...draft, company_display_name: v || null })
              }
            />
          </div>
        </Section>

        {/* AI personality */}
        <Section
          title="AI personality"
          subtitle="How the AI represents your product and speaks to customers."
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                Product context
              </label>
              <textarea
                value={draft.ai_product_context ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, ai_product_context: e.target.value || null })
                }
                rows={5}
                placeholder="Explain to the AI what your product is, who the customer is, and the common questions. The AI will refuse to invent features or policies not grounded in this."
                className="w-full bg-base border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y leading-relaxed"
              />
              <p className="text-[11px] text-muted mt-1.5">
                The AI is honest about its limits. If you don&apos;t describe a topic here, it
                will hand off to a human rather than guess.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                  Tone
                </label>
                <select
                  value={draft.ai_tone}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ai_tone: e.target.value as TenantConfig["ai_tone"],
                    })
                  }
                  className="w-full bg-base border border-default rounded-md px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
                >
                  <option value="warm">Warm</option>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                  <option value="direct">Direct</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                  Response length
                </label>
                <select
                  value={draft.ai_response_length}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ai_response_length: e.target
                        .value as TenantConfig["ai_response_length"],
                    })
                  }
                  className="w-full bg-base border border-default rounded-md px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
                >
                  <option value="short">Short (1-2 sentences)</option>
                  <option value="medium">Medium (1-4 sentences)</option>
                  <option value="long">Long (up to ~6 sentences)</option>
                </select>
              </div>
            </div>
          </div>
        </Section>

        {/* Branding */}
        <Section title="Reply signature" subtitle="Appears at the end of agent replies (optional).">
          <Field
            label="Signature"
            value={draft.reply_signature ?? ""}
            onChange={(v) => setDraft({ ...draft, reply_signature: v || null })}
          />
        </Section>

        {/* Plan */}
        <Section title="Plan">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border border-[#FACC15]/40 bg-[#FACC15]/10 text-brand">
              {draft.plan}
            </span>
            <p className="text-xs text-secondary">
              {draft.monthly_conversation_quota.toLocaleString()} conversations
              per month included.
            </p>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Stripe + tier upgrade ships in Sprint 7. For now, every
            tenant is on the pilot plan.
          </p>
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.02] border border-default rounded-xl p-5">
      <h2 className="text-sm font-semibold text-primary mb-1">{title}</h2>
      {subtitle && (
        <p className="text-[11px] text-muted mb-3">{subtitle}</p>
      )}
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-base border border-default rounded-md px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong ${
          mono ? "font-mono" : ""
        }`}
      />
    </div>
  );
}

