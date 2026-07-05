import { SettingsTabs } from "@/components/care/SettingsTabs";
import { LearningHint } from "@/components/learning/LearningHint";

export default function CareAccountPage() {
  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">Account</p>
      </header>
      <SettingsTabs />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl w-full mx-auto space-y-5">
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Subscription"
          whatItIs="Your current plan and billing status for C.A.R.E — today, that's the invite-only pilot."
          why="It's the honest statement of where the product is: pilots come first so the model is validated before anyone is charged. Billing tiers arrive only once the pilots prove out."
          how="Nothing to set here yet. When Stripe and plan tiers ship, this is where you'll manage them."
          principle="Charge for value only after it's proven, not before."
        >
          <Section title="Subscription">
            <p className="text-xs text-secondary">
              Pilot-stage · invite-only. Stripe + plan tiers ship in
              State B once pilots validate the model.
            </p>
          </Section>
        </LearningHint>
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Operating hours"
          whatItIs="The support hours and response time you publish to customers — deliberately left blank until you've measured what you actually deliver."
          why="A '24/7 support' banner you can't back up erodes trust the first time it's wrong. C.A.R.E refuses to pre-fill a promise; it wants you to advertise a number you've measured."
          how="Run a measurement window first, then set operating hours to the response time your team genuinely hits."
          principle="Never advertise a service level you haven't measured."
        >
          <Section title="Operating hours">
            <p className="text-xs text-secondary leading-relaxed">
              We don&apos;t pre-fill &quot;24/7 support&quot; out of the box.
              Once your team runs a measurement window, you can advertise
              the honest response time you actually deliver.
            </p>
          </Section>
        </LearningHint>
        <LearningHint
          as="block"
          category="C.A.R.E · Settings"
          title="Security"
          whatItIs="A plain-language statement of how C.A.R.E protects your data: row-level security on every table, scoped tokens per traffic type, and service keys kept off the client."
          why="Support tools sit on top of customer conversations — the most sensitive data you hold. This spells out the guarantees so you can answer your own customers' security questions honestly."
          how="Read-only. It documents the posture that's already enforced in the platform; nothing to configure here."
          principle="Security you can describe precisely is security you can actually stand behind."
        >
          <Section title="Security">
            <p className="text-xs text-secondary leading-relaxed">
              Row-level security on every table. Customer-side widget
              traffic uses session tokens; agent-side uses standard auth.
              Service-role keys never touch client bundles.
            </p>
          </Section>
        </LearningHint>
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
