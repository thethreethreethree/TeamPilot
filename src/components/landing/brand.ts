// Landing-only brand tokens (founder spec 2026-08-02): matte black, signal yellow, white.
// Deliberately SEPARATE from the app's ember/ink theme so the marketing page can commit to a
// single premium dark identity without touching the product's 300+ themed surfaces.
export const BRAND = {
  ink: "#141414",
  ink2: "#181818",
  signal: "#FFDA03",
  white: "#F7F7F5",
  mut: "rgba(247,247,245,0.62)",
  hair: "rgba(247,247,245,0.22)",
} as const;

// Where the CTAs point. "Request access" is pilot-honest (no "free" promise); it lands on the
// redeem/login flow that actually provisions an account today.
export const CTA = {
  primaryHref: "/redeem",
  primaryLabel: "Request access",
  signInHref: "/login",
} as const;
