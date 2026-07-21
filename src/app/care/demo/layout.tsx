import type { Metadata } from "next";

/**
 * Metadata wrapper for the C.A.R.E demo page.
 *
 * The page itself is a client component ("use client") and so can't export
 * `metadata`. This server layout supplies it: a real title + description so
 * a shared elostate.com/care/demo link and the browser tab are meaningful
 * (not the generic root default), plus a page-level `robots: noindex` that
 * reinforces the /demo/ disallow in robots.ts — a sales/pitch page, not an
 * SEO surface.
 */
export const metadata: Metadata = {
  title: "C.A.R.E Demo",
  description:
    "See how C.A.R.E answers customers in seconds and hands off to a human who already knows everything — a live, click-by-click walkthrough of the customer support engine.",
  robots: { index: false, follow: false },
};

export default function CareDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
