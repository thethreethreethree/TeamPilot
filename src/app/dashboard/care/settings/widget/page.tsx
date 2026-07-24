"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2, Save, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SettingsTabs } from "@/components/care/SettingsTabs";
import { CURATED_VOICES } from "@/lib/care/voice/curated-client";
import { LearningHint } from "@/components/learning/LearningHint";

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
  ai_name: string;
  voice_id: string | null;
  business_type: "general" | "ecommerce";
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
          // widget_logo_url set via dedicated /logo endpoint only;
          // PATCH no longer accepts it (prevents arbitrary-URL bypass).
          companyDisplayName: draft.company_display_name,
          replySignature: draft.reply_signature,
          aiProductContext: draft.ai_product_context,
          aiTone: draft.ai_tone,
          aiResponseLength: draft.ai_response_length,
          aiName: draft.ai_name,
          voiceId: draft.voice_id,
          businessType: draft.business_type ?? "general",
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
        <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
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
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-primary">Settings</h1>
          <p className="text-[11px] text-muted">
            Widget · embed C.A.R.E on your site
          </p>
        </div>
        <LearningHint
          as="inline-block"
          category="C.A.R.E · Settings"
          title="Save changes"
          whatItIs="Commits every edit on this page — appearance, origins, AI personality, voice — to the live widget at once."
          why="Most fields here are draft-only until you save; the widget your customers load keeps showing the last saved config until you click this. One save publishes them all together, so partial states never reach customers."
          how="Make your edits across the sections below, then click once to publish. The logo upload is the exception — it saves on its own the moment you upload."
          principle="Edits are a draft until published — nothing reaches customers until you save."
        >
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
        </LearningHint>
      </header>
      <SettingsTabs />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {/* Active toggle */}
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Widget status"
          whatItIs="The master on/off switch for the widget across every site it's embedded on."
          why="This is your kill switch and your go-live switch. Paused, embedded sites show a friendly 'paused' notice instead of the chat bubble — useful when you're not ready to staff it, without editing anyone's site code."
          how="Toggle Active on when your team is ready to answer, off to pause everywhere at once. Remember to Save changes to publish the switch."
          principle="Turn support on only when you can honestly answer — a live bubble is a promise."
        >
          <Section title="Status">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary">
                  Widget is{" "}
                  <span
                    className={
                      draft.active ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-muted"
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
        </LearningHint>

        {/* Embed snippet */}
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Embed snippet"
          whatItIs="The one-line script tag you paste into your site's <head> to make the widget appear. It carries the token that identifies your tenant."
          why="This is the physical connection between your site and C.A.R.E. The token in it is what ties customer conversations to your workspace — which is exactly why it only works on the origins you whitelist below."
          how="Click Copy, paste it into the <head> of every page that should show the widget, then add those pages' origins under Allowed origins."
          principle="One snippet, one identity — the token is what makes a conversation yours."
        >
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
        </LearningHint>

        {/* Allowed origins */}
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Allowed origins"
          whatItIs="The whitelist of exact site origins allowed to load and chat through your widget — enforced at the server, not just the browser."
          why="This is the security boundary on your token. Empty by default (fail-safe: nobody can embed your widget on a random site), so if it's blank your widget loads nowhere. Origin headers are exact-match, so a missing https:// or a subdomain mismatch silently blocks real traffic."
          how="Add one origin per line with the protocol and exact host (https://yourbusiness.com), no trailing slash, no path. List www and the bare domain separately if you serve both. Save to enable."
          principle="Exact-match means exact — the widget trusts only origins you spell out precisely."
        >
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
              <div className="mb-3 p-3 rounded-md bg-amber-400/10 border border-amber-400/40 text-xs text-primary leading-relaxed">
                <p className="font-semibold text-brand mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                  Your widget won&apos;t load anywhere yet
                </p>
                <p>
                  We start with this list empty as a safety default —
                  nobody can embed your widget on a random site without
                  your permission. Add at least one origin below (the
                  domain where your widget will live, e.g.{" "}
                  <code className="font-mono text-brand">
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
            autoComplete="off"
            spellCheck={false}
            maxLength={4000}
            placeholder={"https://yourbusiness.com\nhttps://www.yourbusiness.com"}
            className="w-full bg-base border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y font-mono"
          />
          <OriginsValidation raw={originsRaw} />
          <div className="text-[11px] text-muted mt-2 space-y-1">
            <p className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-brand" aria-hidden />
              Origin mismatch attempts are logged and shown in{" "}
              <strong className="text-secondary">Widget traffic</strong> below.
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
        </LearningHint>

        <WidgetLoadEvents />

        {/* Email channel — Phase 4 */}
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Email channel"
          whatItIs="An inbound support address that turns every incoming email into a C.A.R.E conversation, with agent replies threading back to the customer's inbox."
          why="It brings email into the same queue, AI first-responder, and Coach grading as the widget — so support isn't split across two tools. It only appears once the deployment has the email env vars set; otherwise it's honestly marked as off."
          how="Forward your support@ address to the address shown here. If it reads 'not configured', an operator needs to set the CARE_EMAIL env vars first."
          principle="One queue for every channel beats a great answer no one can find the thread of."
        >
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
              <p className="text-xs text-primary">
                Email channel not configured on this deployment yet.
                Set <code className="font-mono">CARE_EMAIL_HOST_DOMAIN</code>{" "}
                and <code className="font-mono">CARE_INBOUND_EMAIL_SECRET</code>{" "}
                env vars to enable it.
              </p>
            </div>
          )}
        </Section>
        </LearningHint>

        {/* Appearance */}
        <Section title="Appearance" subtitle="How the widget looks on your site.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Greeting"
              whatItIs="The opening line the widget shows a customer when it first pops open — the headline of the chat window."
              why="It's the first thing a customer reads, so it sets the tone before anyone types. A specific, human greeting invites a real question; a generic 'How can I help?' gets generic contacts."
              how="Write a short, warm opener in your brand's voice. Keep it to a line so it doesn't crowd the input."
              principle="The first line is a tone-setter — spend it on making contact feel welcome."
            >
              <Field
                label="Greeting"
                value={draft.widget_greeting}
                onChange={(v) => setDraft({ ...draft, widget_greeting: v })}
              />
            </LearningHint>
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Subtitle"
              whatItIs="The smaller line under the greeting — usually a response-time or reassurance note."
              why="It's where you set honest expectations ('Usually replies in a few minutes'), which reduces the number of customers who leave because they didn't know when they'd hear back. Only promise what you actually deliver."
              how="Use it for a true expectation — response time, hours, or a short reassurance. Keep it consistent with your Operating hours."
              principle="Set the expectation you can keep, right where the customer will read it."
            >
              <Field
                label="Subtitle"
                value={draft.widget_subtitle}
                onChange={(v) => setDraft({ ...draft, widget_subtitle: v })}
              />
            </LearningHint>
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Primary color"
              whatItIs="The hex color that themes the widget — the bubble, header, and accents — so it matches your brand."
              why="A widget in your brand color reads as part of your site; a mismatched one reads as a bolted-on third-party tool customers trust less. This is the main white-label lever."
              how="Enter a hex value (e.g. #1D4ED8) that matches your site's primary color. Include the # and use six digits."
              principle="The widget should look like it belongs to you, not to us."
            >
              <Field
                label="Primary color (hex)"
                value={draft.widget_color}
                onChange={(v) => setDraft({ ...draft, widget_color: v })}
                mono
              />
            </LearningHint>
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Position"
              whatItIs="Which bottom corner of the page the chat bubble sits in — right or left."
              why="It's a small choice with real impact: the bubble shouldn't collide with your own site controls (a left-side cart, a right-side back-to-top). Put it where it won't fight your existing UI."
              how="Pick the corner that's clear of your site's other floating elements. Save to move it."
              principle="Place the bubble where it helps, not where it covers something else."
            >
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
            </LearningHint>
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Brand logo / icon"
              whatItIs="The image shown in the widget header and greeting card — your logo or icon."
              why="A recognizable mark reassures the customer they're talking to you, not a stranger. Note this field saves immediately on upload, separately from the page's Save button, so a logo change goes live the moment it succeeds."
              how="Upload a PNG, JPG, SVG, WebP, or ICO up to 2 MB. Use Remove to clear it. A square, transparent-background mark reads best."
              principle="A familiar mark is trust the customer feels before they read a word."
            >
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                  Brand logo / icon
                </label>
              {draft.widget_logo_url ? (
                <div className="flex items-center gap-3 mb-2 p-2 rounded-md border border-default bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draft.widget_logo_url}
                    alt="Current logo"
                    className="w-12 h-12 object-contain bg-base rounded"
                  />
                  <p className="text-[11px] text-muted flex-1 truncate">
                    {draft.widget_logo_url}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch("/api/care/agent/tenant/logo", {
                        method: "DELETE",
                      });
                      if (res.ok) {
                        // M1: same fix as upload — touch only the
                        // logo field, preserve each state's own
                        // prior values (the clear IS saved server-
                        // side immediately).
                        setDraft((d) =>
                          d ? { ...d, widget_logo_url: null } : d
                        );
                        setConfig((c) =>
                          c ? { ...c, widget_logo_url: null } : c
                        );
                        toast.success("Removed", "Logo cleared.");
                      } else {
                        toast.error("Failed", "Couldn't remove logo.");
                      }
                    }}
                    className="text-[11px] text-secondary hover:text-red-700 dark:hover:text-red-300 border border-default hover:border-red-500/40 rounded-md px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append("file", f);
                  const res = await fetch("/api/care/agent/tenant/logo", {
                    method: "POST",
                    body: fd,
                  });
                  if (res.ok) {
                    const data = await res.json();
                    // Per audit M1 (2026-06-24): update ONLY the
                    // logo field, spreading each state's OWN previous
                    // value. The old code spread `draft` into both,
                    // which wrote the user's unsaved edits (ai_name,
                    // etc.) into the saved baseline `config` — making
                    // them look persisted when they weren't. The logo
                    // IS saved server-side immediately, so it's the
                    // only field that belongs in `config` here.
                    setDraft((d) =>
                      d ? { ...d, widget_logo_url: data.logoUrl } : d
                    );
                    setConfig((c) =>
                      c ? { ...c, widget_logo_url: data.logoUrl } : c
                    );
                    toast.success("Uploaded", "Logo saved.");
                  } else {
                    const data = await res.json().catch(() => null);
                    toast.error("Upload failed", data?.error ?? "Try again.");
                  }
                  // Reset the file input so the same file can be re-selected
                  e.target.value = "";
                }}
                className="block w-full text-xs text-muted"
              />
                <p className="text-[11px] text-muted mt-1">
                  2 MB max. PNG, JPG, SVG, WebP, or ICO. Shows in the widget header
                  + greeting card. The current value is the public URL; uploading a
                  new file replaces it.
                </p>
              </div>
            </LearningHint>
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Display name"
              whatItIs="The company name the widget shows customers — what appears as the 'who am I talking to' label."
              why="It's how the customer knows whose support they've reached. Set it to the brand they recognize, which may differ from your legal entity name."
              how="Enter the customer-facing brand name. Leave blank to fall back to the default."
              principle="Show customers the name they know you by, not the one on your paperwork."
            >
              <Field
                label="Display name"
                value={draft.company_display_name ?? ""}
                onChange={(v) =>
                  setDraft({ ...draft, company_display_name: v || null })
                }
              />
            </LearningHint>
          </div>
        </Section>

        {/* AI personality */}
        <Section
          title="AI personality"
          subtitle="How the AI represents your product and speaks to customers."
        >
          <div className="space-y-3">
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Agent name"
              whatItIs="The name the AI introduces itself as and signs its messages with — its persona on your widget."
              why="A named responder feels like a someone, not a bot, which changes how customers engage. It appears in the greeting and every AI message, so it's part of your brand voice. Line breaks and control characters are stripped so what you type is what customers see."
              how="Enter 1–50 characters, no line breaks. Pick a name that fits your brand's tone."
              principle="A name turns a bot into a first responder customers will actually talk to."
            >
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                  Agent name
                </label>
                <input
                  type="text"
                  value={draft.ai_name}
                onChange={(e) =>
                  // Per audit L3 (2026-06-24): strip control + Unicode
                  // line/paragraph separators client-side, mirroring
                  // the server's \p{C}\p{Zl}\p{Zp} transform and the
                  // DB CHECK (migration 0066). Without this the server
                  // silently mutates the saved value and the user sees
                  // their typed name differ from what persisted. WYSIWYG.
                  setDraft({
                    ...draft,
                    ai_name: e.target.value
                      .replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "")
                      .slice(0, 50),
                  })
                }
                maxLength={50}
                placeholder="Jeff"
                className="w-full bg-base border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
              />
                <p className="text-[11px] text-muted mt-1">
                  What your AI introduces itself as. Shows up in the widget greeting
                  (&ldquo;Hi, my name is X.&rdquo;) and in every message the AI sends.
                  1–50 characters; no line breaks.
                </p>
              </div>
            </LearningHint>
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Product context"
              whatItIs="A briefing the AI reads before answering — what your product is, its features by name, pricing/access, and what to hand off to a human."
              why="This is the single biggest lever on whether the AI helps or hurts. When it's uncertain about a feature it defaults to 'no' — telling a customer you can't do something you can, and losing them. Naming features here makes 'yes, we have that' its safe default, and anything you don't name gets handed to a human by design rather than guessed at."
              how="List features by the names customers use, state pricing/access plainly, and be explicit about what the AI must hand off (billing, refunds, account data). Be thorough — the AI only knows what's written here."
              principle="An AI that doesn't know your product will confidently misdescribe it — name what's real so it never has to guess."
            >
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
            </LearningHint>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <LearningHint
                as="block"
                category="C.A.R.E · Settings"
                title="Tone"
                whatItIs="The register the AI writes in — warm, formal, casual, or direct."
                why="Tone is how the AI's answers feel, and it should match your brand. A luxury service reads formal; a dev tool reads direct. A mismatch makes even correct answers feel off-brand."
                how="Pick the register closest to how your team already talks to customers. Save to apply it to every AI reply."
                principle="Correct and off-brand still feels wrong — match the voice to your brand."
              >
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
              </LearningHint>
              <LearningHint
                as="block"
                category="C.A.R.E · Settings"
                title="Response length"
                whatItIs="How long the AI's answers run — short (1–2 sentences), medium, or long (up to ~6)."
                why="Length is a trade-off between speed and completeness. Short suits simple, high-volume questions; long suits products where a thin answer just creates a follow-up. Set it to how much your customers actually need."
                how="Choose based on your typical question. If customers keep replying 'and…?', go longer; if they skim, go shorter."
                principle="Answer at the length the question deserves — not every reply needs to be a paragraph."
              >
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
              </LearningHint>
            </div>
          </div>
        </Section>

        {/* Business type — 0188. Drives the concern-topic list on the customer handoff
            card (and whether the order-number field appears) when Jeff hands off to a
            human. General = SaaS/support topics; E-commerce = order-centric topics. */}
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Business type"
          whatItIs="Whether your customers ask about a service (General) or orders they placed (E-commerce). It sets the list of concerns the widget offers when a conversation is handed to a human, and — for e-commerce — asks for an order number."
          why="A support team and an online store field completely different questions. Showing a returns/tracking/cancel list to a SaaS customer is noise; showing it to a shopper is exactly what they need. Matching the list to your business means the concern the agent sees is the real one."
          how="Pick the one that fits how customers reach you. Save to apply it to the handoff card immediately."
          principle="Ask for the details that match the business — an order number means nothing to a service customer, and everything to a shopper."
        >
        <Section
          title="Business type"
          subtitle="Sets the concern list customers pick from when a conversation is handed to a human — and, for e-commerce, asks for an order number."
        >
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
              Business type
            </label>
            <select
              value={draft.business_type ?? "general"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  business_type: e.target
                    .value as TenantConfig["business_type"],
                })
              }
              className="w-full bg-base border border-default rounded-md px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
            >
              <option value="general">General (service / support)</option>
              <option value="ecommerce">E-commerce (orders / products)</option>
            </select>
          </div>
        </Section>
        </LearningHint>

        {/* Voice — Phase 9 commit 2. The widget surface itself
            is customer-opt-in (they click the mic button); this
            picker only changes which voice Jeff speaks with when
            they do. */}
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Jeff's voice"
          whatItIs="Which voice reads the AI's replies aloud when a customer chooses the voice conversation in the widget."
          why="It only matters once a customer opts into voice (by clicking the mic), but when they do, the voice is the AI's presence — it should suit your brand. Decoupled from the text tone above so you can tune each independently."
          how="Pick a curated voice, or leave it on the deployment default. Need one not listed? Set a custom ElevenLabs voice ID via the API — the picker's kept short on purpose."
          principle="When the AI speaks, the voice is the brand — choose it as deliberately as the words."
        >
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
        </LearningHint>

        {/* Branding */}
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Reply signature"
          whatItIs="An optional line appended to the end of human agent replies — like an email sign-off."
          why="It's a small consistency lever: every agent's reply ends the same, branded way without each person having to type it. Optional, because for some teams a signature adds noise rather than polish."
          how="Set a short sign-off (e.g. '— The Acme team') or leave it blank to append nothing."
          principle="Consistency in the small closing details reads as care in the big ones."
        >
          <Section title="Reply signature" subtitle="Appears at the end of agent replies (optional).">
            <Field
              label="Signature"
              value={draft.reply_signature ?? ""}
              onChange={(v) => setDraft({ ...draft, reply_signature: v || null })}
            />
          </Section>
        </LearningHint>

        {/* Plan */}
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Plan"
          whatItIs="Your current plan and the monthly conversation quota it includes — read-only during the pilot."
          why="It's the honest statement of your usage ceiling: how many conversations are included before tiers matter. Every tenant is on the pilot plan for now, so there's nothing to upgrade yet — and this says so plainly instead of dangling a fake upsell."
          how="Read-only today. When Stripe and tiers ship, this is where you'll change plans and see quota."
          principle="Show the real limit and the real state — don't dress a pilot up as a storefront."
        >
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
        </LearningHint>
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

// Widget traffic — recent load events + wrong-origin attempts (was a "Sprint 7" stub). Self-contained:
// fetches its own admin-only telemetry; degrades to an empty state on any error.
type WidgetLoadResult =
  | "ok"
  | "origin_rejected"
  | "tenant_inactive"
  | "tenant_unknown"
  | "quota_exceeded";
type LoadEventsSummary = {
  events: Array<{
    id: string;
    origin: string | null;
    result: WidgetLoadResult;
    userAgent: string | null;
    createdAt: string;
  }>;
  total: number;
  okCount: number;
  rejectedCount: number;
  rejectedOrigins: string[];
};
const RESULT_LABEL: Record<WidgetLoadResult, string> = {
  ok: "Loaded",
  origin_rejected: "Wrong origin",
  tenant_inactive: "Inactive",
  tenant_unknown: "Unknown token",
  quota_exceeded: "Quota hit",
};

function WidgetLoadEvents() {
  const [summary, setSummary] = useState<LoadEventsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/care/settings/widget/load-events");
        if (res.ok && !cancelled) setSummary(await res.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Section
      title="Widget traffic"
      subtitle="Recent widget loads + wrong-origin attempts on your embed token."
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : !summary || summary.total === 0 ? (
        <p className="text-[11px] text-muted italic">
          No widget loads recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-[11px]">
            <span className="text-secondary">
              <span className="text-primary font-semibold">{summary.okCount}</span> loaded
            </span>
            {summary.rejectedCount > 0 && (
              <span className="text-red-700 dark:text-red-300">
                <span className="font-semibold">{summary.rejectedCount}</span> wrong-origin
              </span>
            )}
          </div>
          {summary.rejectedOrigins.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              <p className="text-[11px] text-red-700 dark:text-red-300 flex items-center gap-1 mb-1">
                <ShieldCheck className="w-3 h-3" aria-hidden /> Your embed token was used
                from these non-allowed origins:
              </p>
              <ul className="text-[11px] text-secondary font-mono space-y-0.5">
                {summary.rejectedOrigins.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {summary.events.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 text-[11px] border-b border-default/50 py-1"
              >
                <span className={e.result === "ok" ? "text-secondary" : "text-red-700 dark:text-red-300"}>
                  {RESULT_LABEL[e.result]}
                </span>
                <span className="text-muted truncate flex-1 mx-2 font-mono">
                  {e.origin ?? "—"}
                </span>
                <span className="text-muted flex-shrink-0">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
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
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label
        htmlFor={`widget-field-${id}`}
        className="block text-[10px] uppercase tracking-widest text-muted mb-1"
      >
        {label}
      </label>
      <input
        id={`widget-field-${id}`}
        type="text"
        autoComplete="off"
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
          className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300/90 bg-amber-500/5 border border-amber-500/30 rounded px-2 py-1"
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

