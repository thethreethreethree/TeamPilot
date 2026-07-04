import type { Metadata } from "next";
import { InstallInstructions } from "@/components/pwa/InstallInstructions";

export const metadata: Metadata = {
  title: "Install ELOSTATE on your phone",
  description:
    "Add ELOSTATE to your home screen in a few taps — no app store, no signup wall.",
};

/**
 * /install — public iOS "Add to Home Screen" walkthrough for ELOSTATE.
 * Public (outside /dashboard) so a first-time user can open it on their
 * phone before signing in. The url is shown as elostate.com to match the
 * founder's reference; swap if the production domain differs.
 */
export default function InstallPage() {
  return (
    <InstallInstructions
      app={{
        displayName: "ELOSTATE",
        url: "elostate.com",
        iconSrc: "/icon.svg",
        backHref: "/login",
        backLabel: "Back to sign in",
      }}
    />
  );
}
