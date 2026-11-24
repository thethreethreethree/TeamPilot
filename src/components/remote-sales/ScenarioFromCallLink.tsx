"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { useIsSalesCoachManager, useCurrentUserRole, isCompanyAdminRole } from "@/lib/hooks/useCurrentUserRole";

/**
 * "Make a practice scenario from this call" (2026-11-25; ledger F17.3). Managers only — the scenario route is
 * manager-only. Opens Training with this call as the source; there the AI can draft the scenario for the manager to
 * edit (no personal details) and save, linked to the call.
 */
export function ScenarioFromCallLink({ sessionId }: { sessionId: string }) {
  const scManager = useIsSalesCoachManager();
  const role = useCurrentUserRole();
  if (!scManager && !isCompanyAdminRole(role)) return null;
  return (
    <Link
      href={`/dashboard/remote-sales/training?fromSession=${encodeURIComponent(sessionId)}`}
      className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary"
    >
      <GraduationCap className="h-3.5 w-3.5" aria-hidden /> Make a practice scenario from this call
    </Link>
  );
}
