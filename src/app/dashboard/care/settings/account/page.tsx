import { SettingsTabs } from "@/components/care/SettingsTabs";

export default function CareAccountPage() {
  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">Account</p>
      </header>
      <SettingsTabs />
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl w-full mx-auto space-y-5">
        <Section title="Subscription">
          <p className="text-xs text-secondary">
            Pilot-stage · invite-only. Stripe + plan tiers ship in
            State B once pilots validate the model.
          </p>
        </Section>
        <Section title="Operating hours">
          <p className="text-xs text-secondary leading-relaxed">
            We don&apos;t pre-fill &quot;24/7 support&quot; out of the box.
            Once your team runs a measurement window, you can advertise
            the honest response time you actually deliver.
          </p>
        </Section>
        <Section title="Security">
          <p className="text-xs text-secondary leading-relaxed">
            Row-level security on every table. Customer-side widget
            traffic uses session tokens; agent-side uses standard auth.
            Service-role keys never touch client bundles.
          </p>
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.02] border border-default rounded-xl p-5">
      <h2 className="text-sm font-semibold text-primary mb-2">{title}</h2>
      {children}
    </div>
  );
}
