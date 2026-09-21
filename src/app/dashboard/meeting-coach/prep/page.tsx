import { MeetingPrepUpRoute } from "@/components/sales-coach/meeting/MeetingPrepUpRoute";

/**
 * Prep-up screen (Team-Sync / Meeting Coach). Collect the goal + must-discuss topics + documents before a
 * meeting; "Start Meeting" carries the prepId to the live coach (Phase 5 wires it into session creation so the
 * coach loads the agenda). Auth/company context comes from the dashboard layout.
 *
 * A SERVER SHELL, DELIBERATELY. MeetingPrepUp builds the browser Supabase client during RENDER
 * (`useMemo(() => createClient(), [])`) so it can push audio straight to storage via a signed
 * upload target, and `createClient()` throws by design when the env is absent — a deliberate
 * fail-loud. A static export renders this page on a machine with no public Supabase env vars set, so
 * that throw lands at BUILD time and takes the whole build down with it.
 *
 * `export const dynamic` is the fix, but it is ONLY honoured in a server component. This file used
 * to be `"use client"` (it held a useRouter call), which made any route segment config inert — so
 * the page was prerendered regardless. The navigation moved into MeetingPrepUpRoute and this shell
 * stayed on the server, which is the shape /dashboard/sales-coach/doors already had for the
 * identical reason.
 *
 * Found 2026-09-21: `npm run build:ci` had been failing on main at exactly this page. Invisible to
 * typecheck, lint and every unit test, because none of them prerender.
 */
export const dynamic = "force-dynamic";

export default function MeetingPrepPage() {
  return <MeetingPrepUpRoute />;
}
