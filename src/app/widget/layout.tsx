import type { Metadata } from "next";
import "@/app/globals.css";

/**
 * Layout for /widget/* — embedded widget pages.
 *
 * Doesn't render the global FeedbackButton, sidebar, toast
 * provider, etc. The iframe is a self-contained surface that
 * lives on a third-party site; bringing the rest of the
 * dashboard chrome would conflict with the host page.
 *
 * robots/title come from the Next.js `metadata` export below, NOT a hand-rolled <meta> in a nested
 * <head>. A nested layout can't own a real <head>, so the manual tag used to sit alongside the ROOT
 * layout's index:true directive — two conflicting robots tags in one head (audit V6 2026-07-22). The
 * metadata export properly OVERRIDES the parent's robots for /widget/*, so exactly one noindex tag is
 * emitted and these tenant-token URLs stay out of search indexes.
 */
export const metadata: Metadata = {
  title: "Customer support",
  robots: { index: false, follow: false },
};

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-transparent text-primary antialiased">{children}</body>
    </html>
  );
}
