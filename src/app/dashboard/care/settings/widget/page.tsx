"use client";

import { Copy, MessageCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SettingsTabs } from "@/components/care/SettingsTabs";

export default function CareWidgetPage() {
  const toast = useToast();
  const snippet = `<script src="https://elostate.com/care-widget.js" data-tenant="YOUR_TENANT_TOKEN"></script>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Copied", "Snippet on your clipboard.");
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">
          Widget · the customer-facing chat that visitors see
        </p>
      </header>
      <SettingsTabs />
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {/* Embed snippet */}
        <div className="bg-white/[0.02] border border-default rounded-xl p-5">
          <h2 className="text-sm font-semibold text-primary mb-2">
            Embed on your site
          </h2>
          <p className="text-xs text-secondary mb-3">
            Drop this script tag in the &lt;head&gt; of your site.
            Visitors get the chat bubble bottom-right; conversations
            land in your inbox here. White-label tenants get a unique
            data-tenant token in the next release.
          </p>
          <div className="relative">
            <pre className="bg-base border border-default rounded-md p-3 text-xs text-primary font-mono overflow-x-auto">
              {snippet}
            </pre>
            <button
              type="button"
              onClick={copy}
              className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-brand bg-[#FACC15]/10 border border-[#FACC15]/40 hover:border-[#FACC15]/70 px-2 py-1 rounded-md"
            >
              <Copy className="w-3 h-3" aria-hidden />
              Copy
            </button>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white/[0.02] border border-default rounded-xl p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">
            Appearance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Greeting" value="We're here to help" />
            <Field label="Subtitle" value="Typical reply: a few seconds" />
            <Field label="Primary color" value="#FACC15" />
            <Field label="Position" value="bottom-right" />
          </div>
          <p className="text-[11px] text-muted mt-3">
            Editable in Sprint 3d. For now these are the defaults
            every tenant gets.
          </p>
        </div>

        {/* AI personality */}
        <div className="bg-white/[0.02] border border-default rounded-xl p-5">
          <h2 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-brand" aria-hidden />
            AI personality
          </h2>
          <p className="text-xs text-secondary leading-relaxed mb-3">
            Our AI replies grounded in a deliberate communication
            discipline: warm, observation-based, resolution-centered,
            honest about what it doesn&apos;t know. It refuses to
            invent product features or fabricate policies.
          </p>
          <p className="text-[11px] text-muted">
            Per-tenant product context configuration ships in Sprint 3d
            so you can teach the AI what your product is and how to
            speak about it.
          </p>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted mb-1">
        {label}
      </p>
      <p className="text-sm text-primary font-mono">{value}</p>
    </div>
  );
}
