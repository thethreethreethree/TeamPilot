import { sora } from "./sora";
import { Hero } from "./Hero";
import { Problem } from "./Problem";
import { Turn } from "./Turn";
import { HowItWorks } from "./HowItWorks";
import { Modules } from "./Modules";
import { Differentiator } from "./Differentiator";
import { Proof } from "./Proof";
import { Close } from "./Close";
import { Footer } from "./Footer";

// The full public marketing landing — the emotional arc, top to bottom. Rendered for LOGGED-OUT
// visitors at `/`; signed-in accounts are redirected to their module home before this renders
// (see src/app/page.tsx). Self-hosted Sora; overflow-x hidden so the body never scrolls sideways.
export function LandingPage() {
  return (
    <div className={sora.className} style={{ background: "#141414", minHeight: "100vh", overflowX: "hidden" }}>
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
