import type { Metadata } from "next";
import { InstallInstructions } from "@/components/pwa/InstallInstructions";

export const metadata: Metadata = {
  title: "Install ELOSTATE Sales Coach on your iPhone",
  description:
    "Add ELOSTATE Sales Coach to your home screen in a few taps — no app store, no signup wall.",
};

/**
 * /sales-coach/install — public iOS "Add to Home Screen" walkthrough for the
 * Sales Coach PWA. Sibling of /sales-coach/login (both public, outside the
 * auth-gated /dashboard/sales-coach subtree). Same card as ELOSTATE, one
 * config (§A21). NOTE (build report): for iOS to capture the *Sales Coach*
 * manifest (its icon + /dashboard/sales-coach start_url), the user must Add
 * to Home Screen while on a Sales Coach page — confirm the url shown here.
 */
export default function SalesCoachInstallPage() {
  return (
    <InstallInstructions
      app={{
        displayName: "ELOSTATE Sales Coach",
        url: "elostate.com",
        iconSrc: "/sales-coach-icon.svg",
        backHref: "/sales-coach/login",
        backLabel: "Back to sign in",
      }}
    />
  );
}
