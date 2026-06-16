import { CareShell } from "@/components/care/CareShell";

/**
 * Layout for every route under /dashboard/care/*.
 *
 * Replaces the default ELOSTATE dashboard sidebar with the Care
 * app shell (own left nav, own product brand, own sub-navigation).
 * The main ELOSTATE shell is still reachable via the "Back to
 * ELOSTATE" footer link in the Care sidebar.
 *
 * This separation matches how every leading support platform
 * (Zendesk, Intercom, Front, HelpScout) treats their product:
 * dedicated chrome, not a tab within a broader app.
 */
export default function CareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CareShell>{children}</CareShell>;
}
