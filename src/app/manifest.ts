import type { MetadataRoute } from "next";

/** Web app manifest for "Add to Home Screen" on mobile + desktop PWA install. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ELOSTATE",
    short_name: "ELOSTATE",
    description:
      "An honest AI executive operating system. Stays silent until it has earned the right to speak.",
    start_url: "/dashboard",
    display: "standalone",
    // PWA manifest is static — cannot follow the user's light/dark
    // preference. We pick the brand's dark base (navy.900) so the install
    // splash matches the dark-mode chrome the OS shows by default. Users
    // on light mode see a brief navy splash on PWA cold-start; an
    // accepted tradeoff for static manifest behavior. See docs/BRAND.md.
    background_color: "#0A1429",
    theme_color: "#0A1429",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
