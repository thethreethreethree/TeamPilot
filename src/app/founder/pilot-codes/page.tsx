import { notFound } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { getVendorCompanyId, isVendorAdmin } from "@/lib/crm/vendorAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizePilotCodes } from "@/lib/pilot/summarizePilotCodes";

export const dynamic = "force-dynamic";

/**
 * /founder/pilot-codes — FOUNDER-ONLY pilot-code tracker.
 *
 * Answers the Sales-department operational question the module directive opened but nothing surfaced: of the
 * 100 seeded pilot codes, how many are spent vs available (per module), and who redeemed which. `pilot_codes`
 * is RLS-sealed (deny-all to members), so this reads via the admin client — behind the SAME vendor-admin gate
 * as /founder/files (notFound() on failure, so a customer guessing the URL learns nothing).
 *
 * Security-conscious v1: it lists REDEEMED codes (already spent — safe to show) with who + when, and reports
 * AVAILABLE codes as COUNTS ONLY — it deliberately does NOT render live/unredeemed access keys in a web page
 * (browser history / screen-share exposure). The founder has the master handout for the actual keys.
 */

const MODULE_LABEL: Record<string, string> = {
  elostate: "Complete",
  care: "C.A.R.E",
  sales_coach: "Sales Coach",
};
const MODULE_ORDER = ["elostate", "sales_coach", "care"];

type PilotCode = {
  code: string;
  module: string;
  redeemed_at: string | null;
  redeemed_by_email: string | null;
  redeemed_company_id: string | null;
};

export default async function FounderPilotCodesPage() {
  const ctx = await getCurrentAuthContext();
  if (!isVendorAdmin(ctx, getVendorCompanyId())) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: codesRaw } = await admin
    .from("pilot_codes")
    .select("code, module, redeemed_at, redeemed_by_email, redeemed_company_id")
    .order("redeemed_at", { ascending: false, nullsFirst: false });
  const codes = (codesRaw ?? []) as PilotCode[];

  // Company names for the redeemed rows (RLS-sealed table → admin client, separate lookup to avoid
  // depending on a PostgREST FK-embed alias).
  const companyIds = [...new Set(codes.map((c) => c.redeemed_company_id).filter(Boolean))] as string[];
  const companyName = new Map<string, string>();
  if (companyIds.length) {
    const { data: comps } = await admin.from("companies").select("id, name").in("id", companyIds);
    for (const c of (comps ?? []) as { id: string; name: string | null }[]) {
      if (c.name) companyName.set(c.id, c.name);
    }
  }

  // Counts via the pure, tested summarizer (src/lib/pilot/summarizePilotCodes.ts) so the founder-facing
  // spent/available numbers can't silently drift.
  const { total: totalCodes, redeemed: totalRedeemed, byModule: summary } = summarizePilotCodes(
    codes,
    MODULE_ORDER
  );
  const redeemedList = codes.filter((c) => c.redeemed_at);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="min-h-screen bg-base px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <div className="text-xs font-mono uppercase tracking-[0.18em] text-brand">Founder · Pilot codes</div>
          <h1 className="mt-2 text-2xl font-bold text-primary">Pilot access codes</h1>
          <p className="mt-1 text-sm text-muted">
            Redemption status for the seeded pilot codes. Available codes are shown as counts only — live keys
            are never rendered here; use the handout for the actual keys.
          </p>
        </div>

        {/* Summary — the operational headline: spent vs available, overall + per module. */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-primary">{totalRedeemed}</span>
            <span className="text-sm text-muted">/ {totalCodes} codes redeemed</span>
            <span className="ml-auto text-sm text-secondary">{totalCodes - totalRedeemed} available</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {summary.map((s) => (
              <div key={s.module} className="rounded-lg border border-default bg-surface px-3 py-2.5">
                <div className="text-xs uppercase tracking-wide text-brand">{MODULE_LABEL[s.module] ?? s.module}</div>
                <div className="mt-1 text-sm text-primary">
                  <span className="font-semibold">{s.redeemed}</span>
                  <span className="text-muted"> / {s.total} redeemed</span>
                </div>
                <div className="text-[11px] text-secondary">{s.available} available</div>
              </div>
            ))}
          </div>
        </div>

        {/* Redeemed codes — spent, so safe to show, with who + when. */}
        <div className="glass-card p-6">
          <h2 className="text-base font-semibold text-primary mb-3">Redeemed ({redeemedList.length})</h2>
          {redeemedList.length === 0 ? (
            <p className="text-sm text-muted">No codes redeemed yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-default">
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 pr-3 font-medium">Module</th>
                    <th className="py-2 pr-3 font-medium">Redeemed by</th>
                    <th className="py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {redeemedList.map((c) => (
                    <tr key={c.code} className="border-b border-default/50">
                      <td className="py-2 pr-3 font-mono text-primary">{c.code}</td>
                      <td className="py-2 pr-3 text-secondary">{MODULE_LABEL[c.module] ?? c.module}</td>
                      <td className="py-2 pr-3 text-secondary">
                        {c.redeemed_company_id && companyName.get(c.redeemed_company_id) ? (
                          <span className="text-primary">{companyName.get(c.redeemed_company_id)}</span>
                        ) : null}
                        {c.redeemed_by_email ? (
                          <span className="block text-[11px] text-muted">{c.redeemed_by_email}</span>
                        ) : null}
                      </td>
                      <td className="py-2 text-secondary">{fmtDate(c.redeemed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
