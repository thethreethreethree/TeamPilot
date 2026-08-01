import { notFound } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { getVendorCompanyId, isVendorAdmin } from "@/lib/crm/vendorAuth";

export const dynamic = "force-dynamic";

/**
 * /founder/files — FOUNDER-ONLY file area.
 *
 * Gated by the same vendor-admin predicate as the download route. Uses notFound() (404) rather
 * than a redirect on failure so a customer who guesses the URL learns nothing — the page simply
 * does not exist for them (same reasoning as requireVendorAdmin's identical-error posture).
 */
export default async function FounderFilesPage() {
  const ctx = await getCurrentAuthContext();
  if (!isVendorAdmin(ctx, getVendorCompanyId())) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-base px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <div className="text-xs font-mono uppercase tracking-[0.18em] text-brand">
            Founder · Files
          </div>
          <h1 className="mt-2 text-2xl font-bold text-primary">Files</h1>
          <p className="mt-1 text-sm text-muted">
            Private downloads, visible only to the founder account.
          </p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-primary">
                Build a SaaS From Scratch — The Beginner&apos;s Manual
              </h2>
              <p className="mt-1 text-sm text-secondary">
                The complete step-by-step guide to building an app or SaaS by directing an AI
                under the Thinkx governed-build system. PDF.
              </p>
            </div>
            <a
              href="/founder/files/buildmanual"
              className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-ember-400 px-3.5 py-2 text-sm font-semibold text-[#09090B] transition-colors hover:bg-ember-500"
            >
              Download PDF
            </a>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          The download link is founder-only — anyone else who opens it receives an access error.
        </p>

        <div className="mt-6 border-t border-default pt-4">
          <a
            href="/founder/pilot-codes"
            className="text-sm text-brand hover:text-primary inline-flex items-center gap-1.5"
          >
            Pilot-code redemption tracker →
          </a>
          <p className="mt-1 text-xs text-muted">
            How many of the seeded pilot codes are spent vs available, and who redeemed which.
          </p>
        </div>
      </div>
    </div>
  );
}
