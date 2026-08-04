import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

// Preview of the public landing (same component `/` serves to logged-out visitors). Kept so the
// team can view the marketing page even while signed in — `/` redirects a signed-in account to
// its module. noindex so it doesn't compete with `/` in search.
export const metadata: Metadata = {
  title: "Elostate — landing preview",
  robots: { index: false, follow: false },
};

export default function LandingPreview() {
  return <LandingPage />;
}
