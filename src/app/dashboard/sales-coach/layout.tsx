import { SalesCoachShell } from "@/components/sales-coach/SalesCoachShell";

/**
 * Layout for every route under /dashboard/sales-coach/*.
 *
 * Wraps them in the Sales Coach product shell (own brand, own nav, Back
 * to ELOSTATE) — mirroring how /dashboard/care uses CareShell (§A21), so
 * Sales Coach is its own product surface within Elostate.
 */
export default function SalesCoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SalesCoachShell>{children}</SalesCoachShell>;
}
