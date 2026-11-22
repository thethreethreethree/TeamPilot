/**
 * Shown on a finance sub-page when its data FAILED TO LOAD — a network error or a server error.
 *
 * Split from FinanceNotSetUp (2026-11-23). Fifteen sub-pages rendered "Finance isn't set up yet — initialize the Chart
 * of Accounts" from `load().catch(...)`, i.e. on any failed load; none of them checks for an empty Chart of Accounts, so
 * an admin was told to initialize finance they had already set up. A failed load is a different fact with a different
 * next action: try again.
 */
export default function FinanceLoadFailed({ feature }: { feature: string }) {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <section className="glass-card p-6 text-center" role="alert">
        <h2 className="text-sm font-semibold text-primary mb-2">Couldn&apos;t load {feature}</h2>
        <p className="text-xs text-muted">Something went wrong reaching the server. Refresh the page to try again.</p>
      </section>
    </div>
  );
}
