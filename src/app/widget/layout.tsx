import "@/app/globals.css";

/**
 * Layout for /widget/* — embedded widget pages.
 *
 * Doesn't render the global FeedbackButton, sidebar, toast
 * provider, etc. The iframe is a self-contained surface that
 * lives on a third-party site; bringing the rest of the
 * dashboard chrome would conflict with the host page.
 */
export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex,nofollow" />
        <title>Customer support</title>
      </head>
      <body className="bg-transparent text-primary antialiased">{children}</body>
    </html>
  );
}
