"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2, Save, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SettingsTabs } from "@/components/care/SettingsTabs";
import { CURATED_VOICES } from "@/lib/care/voice/curated-client";

// Normalize an origin entry the way Origin headers actually appear:
//   "  https://Foo.com/  " → "https://foo.com"
//   "foo.com"              → "foo.com"  (kept as-is, flagged in UI)
//   "*"                    → "*"
// We don't auto-prepend a protocol — that would mask the user's
// intent. Instead the settings UI surfaces a yellow warning row
// for any entry without a scheme so they can decide.
function normalizeOrigin(raw: string): string {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return "";
  if (t === "*") return "*";
  try {
    const u = new URL(t);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return t.toLowerCase();
  }
}

function originIsValid(o: string): boolean {
  if (o === "*") return true;
  return /^https?:\/\/[^/\s]+$/.test(o);
}

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
  voice_id: string | null;
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
  // Phase 4 email channel — surfaced from the tenant config
  // endpoint. Null when the deployment doesn't have
  // CARE_EMAIL_HOST_DOMAIN configured (the channel is off).
  const [inboundEmailAddress, setInboundEmailAddress] = useState<string | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/care/agent/tenant");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setDraft(data.config);
        setOriginsRaw((data.config.allowed_origins ?? []).join("\n"));
        setInboundEmailAddress(data.inboundEmailAddress ?? null);
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
      // Normalize each origin: trim, drop trailing slashes, lowercase
      // the host. Browser Origin headers are exact-match so user-
      // typed entries like "ElO state.com /" or "https://X.com/" must
      // collapse to a canonical form before they hit the DB.
      const allowedOrigins = originsRaw
        .split("\n")
        .map((s) => normalizeOrigin(s))
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
          voiceId: draft.voice_id,
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

  // Derive the script src from the dashboard's own origin so the
  // snippet works whether we're on elostate.com, a staging URL, a
  // localhost dev port, or a white-label custom domain. Falls back
  // to the production host for SSR safety (window is undefined
  // briefly on first render).
  const scriptOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://elostate.com";
  const snippet = `<script src="${scriptOrigin}/care-widget.js" data-token="${config.embed_token}"></script>`;

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
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-ember-400 hover:bg-ember-500 disabled:opacity-50 text-[#09090B] px-3 py-1.5 rounded-md"
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
                className="accent-ember-400"
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
              className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-brand bg-ember-400/10 border border-ember-400/40 hover:border-ember-400/70 px-2 py-1 rounded-md"
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
          {/* First-run warning — fires when the saved config has
              no allowed origins yet. New tenants get
              allowed_origins=[] by default (fail-safe — no
              embedding until explicitly authorized), but
              without this banner they'd paste the embed
              snippet, get nothing, and not know why. */}
          {(!config?.allowed_origins ||
            config.allowed_origins.length === 0) &&
            originsRaw.trim().length === 0 && (
              <div className="mb-3 p-3 rounded-md bg-amber-400/10 border border-amber-400/40 text-xs text-amber-200 leading-relaxed">
                <p className="font-semibold text-amber-100 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                  Your widget won&apos;t load anywhere yet
                </p>
                <p>
                  We start with this list empty as a safety default —
                  nobody can embed your widget on a random site without
                  your permission. Add at least one origin below (the
                  domain where your widget will live, e.g.{" "}
                  <code className="font-mono text-amber-100">
                    https://yourbusiness.com
                  </code>
                  ) and save to enable it.
                </p>
              </div>
            )}
          <textarea
            value={originsRaw}
            onChange={(e) => setOriginsRaw(e.target.value)}
            rows={4}
            placeholder={"https://yourbusiness.com\nhttps://www.yourbusiness.com"}
            className="w-full bg-base border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y font-mono"
          />
          <OriginsValidation raw={originsRaw} />
          <div className="text-[11px] text-muted mt-2 space-y-1">
            <p className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-brand" aria-hidden />
              Origin mismatch attempts are logged. Visible to you at
              /dashboard/care/settings/widget &gt; load events (Sprint 7).
            </p>
            <p className="leading-relaxed">
              <strong className="text-secondary">Format:</strong> include
              the protocol (<code className="font-mono">https://</code>)
              and the exact host. No trailing slash, no path. Subdomains
              are separate (e.g. <code className="font-mono">www</code>{" "}
              and the bare domain are two entries if you serve from both).
            </p>
          </div>
        </Section>

        {/* Email channel — Phase 4 */}
        <Section
          title="Email channel"
          subtitle="Customers can email your support address; replies thread back into the same conversation here."
        >
          {inboundEmailAddress ? (
            <>
              <div className="bg-base border border-default rounded-md px-3 py-2.5 flex items-center justify-between gap-2">
                <code className="text-sm text-primary font-mono truncate">
                  {inboundEmailAddress}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(inboundEmailAddress);
                    toast.success("Copied.");
                  }}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-ember-400 border border-default hover:border-strong px-2 py-1 rounded"
                >
                  <Copy className="w-3 h-3" aria-hidden />
                  Copy
                </button>
              </div>
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                Forward <code className="font-mono">support@yourcompany.com</code>{" "}
                to the address above. Every incoming email becomes a new
                conversation in C.A.R.E with the AI first responder
                running the same shape as the widget. Agent replies in
                this dashboard get dispatched as outbound email,
                threaded back to the customer&apos;s original message.
              </p>
              <p className="text-[10px] text-muted mt-2 italic">
                §3.1 — each email is an immutable event in the chain.
                §A16 — Coach + Co-Pilot grade and draft email replies
                on the same rubric as widget replies.
              </p>
            </>
          ) : (
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-md px-3 py-2.5">
              <p className="text-xs text-amber-200">
                Email channel not configured on this deployment yet.
                Set <code className="font-mono">CARE_EMAIL_HOST_DOMAIN</code>{" "}
                and <code className="font-mono">CARE_INBOUND_EMAIL_SECRET</code>{" "}
                env vars to enable it.
              </p>
            </div>
          )}
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
                rows={10}
                placeholder={`What ELOSTATE actually is:
[one sentence — the product in plain terms]

Features the AI should know about (use these names when customers ask):
- [Feature 1] — [one sentence: what it does, when to mention it]
- [Feature 2] — [...]
- [Feature 3] — [...]

Pricing & access:
[how customers can buy / what tier they get / what to hand off]

Always hand off to a human for:
[account-specific data, billing, refunds, anything you don't want the AI deciding]`}
                className="w-full bg-base border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y leading-relaxed font-mono"
              />
              <div className="text-[11px] text-muted mt-1.5 space-y-1">
                <p>
                  <strong className="text-secondary">Why this matters:</strong>{" "}
                  When the AI is uncertain about a feature, it defaults to
                  &quot;no&quot; — telling the customer your product can&apos;t
                  do something it actually does. They walk away. Listing
                  features by name here makes &quot;yes, we have that&quot; the
                  AI&apos;s safe default for things you actually offer.
                </p>
                <p>
                  Anything you don&apos;t name here, the AI will hand off to a
                  human rather than guess — that&apos;s the design. Be
                  explicit about features that exist; the AI is told to never
                  confidently say &quot;no&quot; when uncertain.
                </p>
              </div>
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

        {/* Voice — Phase 9 commit 2. The widget surface itself
            is customer-opt-in (they click the mic button); this
            picker only changes which voice Jeff speaks with when
            they do. */}
        <Section
          title="Jeff's voice"
          subtitle="Which voice plays back Jeff's replies when a customer enters the voice conversation. Customers still have to opt in by clicking the mic button — this just picks the voice."
        >
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
              Voice
            </label>
            <select
              value={draft.voice_id ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, voice_id: e.target.value || null })
              }
              className="w-full bg-base border border-default rounded-md px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
            >
              <option value="">Deployment default (Antoni)</option>
              {CURATED_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.description}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted mt-2 leading-relaxed">
              The voice plays only when a customer opts into voice
              conversation in the widget. Need a voice not in this
              list? Set a custom ElevenLabs voice ID via the API
              directly; we kept this picker short so it doesn&apos;t
              overwhelm the page.
            </p>
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
            <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border border-ember-400/40 bg-ember-400/10 text-brand">
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

// Live validation of the allowed_origins textarea. Surfaces entries
// that look wrong before the admin saves and discovers their widget
// is silently broken on real customer traffic. Doesn't block save —
// surface, don't overtake.
function OriginsValidation({ raw }: { raw: string }) {
  const issues = useMemo(() => {
    const lines = raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return lines
      .map((line) => {
        const normalized = normalizeOrigin(line);
        if (!originIsValid(normalized)) {
          return {
            line,
            normalized,
            reason:
              normalized && !normalized.startsWith("http")
                ? "Missing https:// — Origin headers are exact-match, so this won't match real traffic."
                : "Doesn't look like a valid origin.",
          };
        }
        return null;
      })
      .filter((x): x is { line: string; normalized: string; reason: string } => x !== null);
  }, [raw]);

  if (issues.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {issues.map((iss, i) => (
        <div
          key={i}
          className="flex items-start gap-1.5 text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/30 rounded px-2 py-1"
        >
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
          <span>
            <span className="font-mono">{iss.line}</span> — {iss.reason}
          </span>
        </div>
      ))}
    </div>
  );
}

