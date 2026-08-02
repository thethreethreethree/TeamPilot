import type { Metadata } from "next";
import { sora } from "@/components/landing/sora";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Turn } from "@/components/landing/Turn";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Modules } from "@/components/landing/Modules";
import { Differentiator } from "@/components/landing/Differentiator";
import { Proof } from "@/components/landing/Proof";
import { Close } from "@/components/landing/Close";
import { Footer } from "@/components/landing/Footer";

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
      <Problem />
      <Turn />
      <HowItWorks />
      <Modules />
      <Differentiator />
      <Proof />
      <Close />
      <Footer />
    </div>
  );
}
