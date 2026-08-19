import { redirect } from "next/navigation";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";

/**
 * Manager-only gate for every /dashboard/schedule/* route (founder decision 2026-08-19: "Manager-only").
 *
 * Schedule WRITES are already manager-gated at every API (RQ6, ctx.isAdmin). The READS were member-visible
 * with NO page gate, so a non-manager could open every schedule page and see (a) write buttons that 403 on
 * click — broken UX — and (b) staff data including sick time-off. This server-side gate redirects a
 * non-manager to /dashboard before any schedule page renders, sidestepping the sick-leave visibility question
 * until per-person self-service (Phase 6).
 *
 * It reuses `getCurrentAuthContext().isAdmin` — the SAME predicate every schedule API enforces (RQ6) — so the
 * page gate and the API gate cannot drift (single-source decision, §2.2). Server-side (not a client redirect)
 * so a non-manager never sees a page flash. Demo mode (no Supabase) bypasses. Schedule is NOT a hard-locked
 * module (0207), so redirecting a complete-access non-manager to /dashboard cannot loop.
 */
export default async function ScheduleLayout({ children }: { children: React.ReactNode }) {
  if (supabaseEnabled) {
    const ctx = await getCurrentAuthContext();
    if (!ctx || !ctx.isAdmin) redirect("/dashboard");
  }
  return <>{children}</>;
}
