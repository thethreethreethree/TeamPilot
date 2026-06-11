import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { ToastProvider } from "@/components/ui/toast";

/**
 * No-flash theme bootstrap.
 *
 * Why this runs inline before paint: if React mounts and *then* sets
 * `data-theme`, the page renders one frame in dark mode (the CSS default)
 * before swapping to light — a visible white-then-dark flash that looks
 * like a bug. We have to resolve the user's preference and set the
 * attribute BEFORE the first paint.
 *
 * Reads `execos.theme.v1` from localStorage. Falls back to the OS
 * `prefers-color-scheme` media query. Defaults to dark.
 *
 * The wrapping IIFE + try/catch is required: localStorage can throw in
 * private browsing / disabled-storage contexts, and we never want a
 * theme failure to crash the page.
 */
const NO_FLASH_THEME_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('execos.theme.v1');
    var pref = stored || 'system';
    var resolved;
    if (pref === 'light' || pref === 'dark') {
      resolved = pref;
    } else {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`.trim();

const TITLE = "ELOSTATE — Problem Solving System for Teams";
const DESCRIPTION =
  "A problem-solving system for teams. ELOSTATE refuses to give you an answer it hasn't earned — it stays silent until it has real evidence, asks for your read before it speaks, and learns only from outcomes that actually held.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s · ELOSTATE",
  },
  description: DESCRIPTION,
  applicationName: "ELOSTATE",
  // metadataBase is used to resolve relative URLs in OG tags. In production set
  // NEXT_PUBLIC_SITE_URL to your deployed origin; falls back to a placeholder
  // so build doesn't fail in dev.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4321"
  ),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "ELOSTATE",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.webmanifest",
  // Discourage automatic phone-number / address linkification in mobile Safari.
  formatDetection: {
    telephone: false,
    address: false,
  },
};

// Viewport themeColor reacts per-mode so the mobile chrome (Android URL bar,
// PWA shell) matches the active surface.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Resolves theme before paint — see NO_FLASH_THEME_SCRIPT comment. */}
        <Script
          id="execos-no-flash-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }}
        />
      </head>
      <body className="min-h-screen bg-base text-primary antialiased">
        <ThemeProvider>
          {/* ToastProvider here (in addition to dashboard layout) so the
              feedback button — which needs toast — works on public pages
              too. Nested ToastProvider in /dashboard layout is harmless;
              the dashboard one will be its own context within. */}
          <ToastProvider>
            {children}
            {/* Floating feedback button — visible on every page per
                the user's directive. Auth-aware: routes to /login on
                public pages, opens the slide-out panel on authed pages. */}
            <FeedbackButton />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
