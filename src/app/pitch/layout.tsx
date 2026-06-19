import type { Metadata } from "next";

/**
 * Pitch page layout — sets SEO + social metadata for the public
 * pitch deck. The page itself is "use client" so it can't export
 * metadata directly; this layout wraps it.
 *
 * Per Wave AN audit (2026-06-19): the pitch page previously had
 * no metadata, meaning shared links / browser tabs showed only
 * the route path. SEO-critical for a marketing surface.
 */
export const metadata: Metadata = {
  title: "ELOSTATE Pitch — Operating discipline for the AI era",
  description:
    "ELOSTATE is the operating discipline for teams that refuse to perform productivity. Reasoning over activity, consequence over agreement, durability over closure.",
  openGraph: {
    title: "ELOSTATE Pitch",
    description:
      "The operating discipline for teams that refuse to perform productivity.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ELOSTATE Pitch",
    description:
      "The operating discipline for teams that refuse to perform productivity.",
  },
};

export default function PitchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
