import type { Metadata } from "next";
import { sora } from "@/components/landing/sora";
import { WowHero } from "@/components/landing/wow/WowHero";
import { WowDifferentiator } from "@/components/landing/wow/WowDifferentiator";
import { WowSections, WowSectionsAfter } from "@/components/landing/wow/WowSections";

// Preview-only route for the landing rebuild (2026-08-15). The LIVE landing at `/` and the
// existing `/landing-preview` are untouched — this exists so the founder can judge the two
// highest-priority sections from the 2026-08-02 brief (hero + differentiator) on screen before
// anything ships. noindex, same as landing-preview.
export const metadata: Metadata = {
  title: "Elostate — landing rebuild (hero + differentiator)",
  robots: { index: false, follow: false },
};

export default function LandingWow() {
  return (
    <div className={sora.className} style={{ background: "#141414", minHeight: "100vh", overflowX: "hidden" }}>
      <WowHero />
      <WowSections />
      <WowDifferentiator />
      <WowSectionsAfter />
    </div>
  );
}
