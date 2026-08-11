import { sora } from "./sora";
import { siteUrl } from "@/lib/siteUrl";
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
  // Organization structured data (schema.org / JSON-LD) — helps search engines identify the entity + surface
  // the logo in a knowledge panel. STATIC + factual: name/url/logo only, all from existing constants (no
  // marketing claims, no ratings/offers to fabricate). Server-rendered (this is a server component) so crawlers
  // see it without JS. Extend later with `sameAs` (social profiles), `description`, `foundingDate` as those
  // facts become available — those are founder-supplied.
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ELOSTATE",
    url: siteUrl(),
    logo: `${siteUrl()}/elostate-logo.png`,
  };
  return (
    <div className={sora.className} style={{ background: "#141414", minHeight: "100vh", overflowX: "hidden" }}>
      {/* JSON-LD via dangerouslySetInnerHTML is the standard schema.org pattern; __html is JSON.stringify of a
          STATIC trusted object (no user/DB data) → no XSS surface. Allowlisted in invariant-audit INV10. */}
      {/* eslint-disable-next-line react/no-danger -- static JSON-LD from constants; zero user input, no XSS surface. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
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
