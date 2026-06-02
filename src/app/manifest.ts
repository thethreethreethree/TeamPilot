import type { MetadataRoute } from "next";

/** Web app manifest for "Add to Home Screen" on mobile + desktop PWA install. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExecOS",
    short_name: "ExecOS",
    description:
      "An honest AI executive operating system. Stays silent until it has earned the right to speak.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0c0d16",
    theme_color: "#0c0d16",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [],
  };
}
