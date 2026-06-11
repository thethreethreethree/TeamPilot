import type { MetadataRoute } from "next";

/** Web app manifest for "Add to Home Screen" on mobile + desktop PWA install.
 *  Identity comes from docs/BRAND.md — amber lightbulb on matte black. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ELOSTATE",
    short_name: "ELOSTATE",
    description:
      "ELOSTATE stays silent until it has earned the right to speak.",
    start_url: "/dashboard",
    display: "standalone",
    // Matte black with an ember theme accent so the OS install splash
    // matches the brand. background_color paints the splash field;
    // theme_color paints the address bar / title bar tint.
    background_color: "#09090B",
    theme_color: "#FACC15",
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
