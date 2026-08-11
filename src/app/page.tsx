import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { resolveUserLanding } from "@/lib/nav/landing";
import { LandingPage } from "@/components/landing/LandingPage";

/**
 * Homepage (`/`).
 *
 * SERVER component so the auth decision happens before render (no marketing-page flash for a
 * signed-in user):
 *   - Signed-in  → redirected to their DESIGNATED module / subscription home via the canonical
 *                  `resolveUserLanding` (the same access_module signal the middleware confines on,
 *                  so this landing and the confinement can't drift — A21). care → /dashboard/care,
 *                  sales_coach → /dashboard/sales-coach, complete/legacy → /dashboard.
 *   - Signed-out → the public marketing landing (LandingPage).
 *
 * The previous homepage was a client marketing page that showed to EVERYONE, including signed-in
 * accounts (middleware never matched `/`). Founder directive 2026-08-04: each account lands on its
 * module; only logged-out visitors see the marketing page.
 */
const HOME_TITLE = "Elostate — Make your productivity tools actually productive";
const HOME_DESC =
  "Finally, an AI system that makes your productivity tools actually productive — a system that helps your team evolve. Built by business owners just like you.";
const OG_DESC =
  "Finally, an AI system that makes your productivity tools actually productive. A system that helps your team evolve.";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESC,
  // Marketing-specific share preview (the root layout's OG is the generic app card). Inherits
  // metadataBase + robots from the layout; overrides the OG/Twitter copy + image for the homepage.
  openGraph: {
    title: HOME_TITLE,
    description: OG_DESC,
    images: [{ url: "/og-home.png", width: 1200, height: 630, alt: HOME_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: OG_DESC,
    images: ["/og-home.png"],
  },
};

export default async function Home() {
  if (supabaseEnabled) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      const dest = await resolveUserLanding(
        supabase,
        user.id,
        (profile?.company_id as string | null) ?? null,
      );
      redirect(dest);
    }
  }
  return <LandingPage />;
}
