import type { Metadata } from "next";
import { sora } from "@/components/landing/sora";
import { Hero } from "@/components/landing/Hero";
import { Differentiator } from "@/components/landing/Differentiator";

// PREVIEW ONLY — the rebuilt Elostate landing, assembled section by section here so live
// elostate.com (src/app/page.tsx) stays untouched until the founder approves. Once approved,
// page.tsx adopts these components.
export const metadata: Metadata = {
  title: "Elostate — landing preview",
  robots: { index: false, follow: false },
};

export default function LandingPreview() {
  return (
    <div className={sora.className} style={{ background: "#141414", minHeight: "100vh" }}>
      {/* html smooth-scroll so "See it work" glides to the differentiator */}
      <style>{`html{scroll-behavior:smooth}`}</style>

      <Hero />
      <Differentiator />
    </div>
  );
}
