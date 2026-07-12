/**
 * Shown on a finance sub-page (AP/AR/Expenses/POs/Recurring) when the company hasn't initialized
 * finance yet — the Chart of Accounts is empty, so every form on the page would be non-functional.
 *
 * AMD-006 layer 3 (workflow continuity): without this, a user who reaches a sub-page via the
 * FinanceNav tabs before initializing hits a dead end — empty dropdowns, a form that errors on
 * submit, no explanation. This replaces that dead end with a clear next action (go initialize).
 */
export default function FinanceNotSetUp({ feature }: { feature: string }) {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <section className="glass-card p-6 text-center">
        <h2 className="text-sm font-semibold text-primary mb-2">Finance isn&apos;t set up yet</h2>
        <p className="text-xs text-muted mb-4">
          {feature} needs the Chart of Accounts. Initialize finance on the Overview page first, then
          come back — everything here will be ready.
        </p>
        <a
          href="/dashboard/finance"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium"
        >
          Go to Overview →
        </a>
      </section>
    </div>
  );
}
