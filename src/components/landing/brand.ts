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

// Where the CTAs point. "Request access" is pilot-honest (no "free" promise).
// Destination = /login (NOT /redeem): the founder pre-authorized "/redeem or /login, as today", the
// old homepage used /login, and /login has OPEN signup (create account → /onboarding, no access key) —
// so a cold marketing visitor can actually convert instead of dead-ending on /redeem's key wall.
// (/redeem stays the flow for pilot invitees, who arrive via their direct code link.)
export const CTA = {
  primaryHref: "/login",
  primaryLabel: "Request access",
  signInHref: "/login",
} as const;
