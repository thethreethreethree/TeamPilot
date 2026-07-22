import type { Metadata } from "next";

/**
 * Metadata wrapper for the Sales Coach demo page (mirrors care/demo/layout.tsx).
 *
 * The page is a client component and can't export `metadata`; this server layout supplies a real title
 * + description (so a shared elostate.com/sales/demo link is meaningful) and page-level robots:noindex —
 * a sales/pitch page, not an SEO surface.
 */
export const metadata: Metadata = {
  title: "Sales Coach Demo",
  description:
    "See how Sales Coach coaches a rep in the moment — live cues on the call, a debrief with one thing to fix, and skills that improve against their own past. A live, click-by-click walkthrough.",
  robots: { index: false, follow: false },
};

export default function SalesDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
