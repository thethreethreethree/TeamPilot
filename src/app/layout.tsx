import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { CareChatWidget } from "@/components/care/CareChatWidget";
import { ToastProvider } from "@/components/ui/toast";
import { siteUrl } from "@/lib/siteUrl";

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

const TITLE = "ELOSTATE";
// Product-descriptive, not slogan. The slogan slot is intentionally
// empty until the canonical slogan is provided — do not invent one.
const DESCRIPTION =
  "ELOSTATE refuses to give you an answer it hasn't earned. It stays silent until it has real evidence, asks for your read before it speaks, and learns only from outcomes that actually held.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s · ELOSTATE",
  },
  description: DESCRIPTION,
  applicationName: "ELOSTATE",
  // metadataBase resolves relative URLs in the canonical + OG tags. Prefer an
  // explicit NEXT_PUBLIC_SITE_URL; else Vercel's stable production domain; else a
  // dev placeholder — so prod never emits a localhost canonical (siteUrl()).
  metadataBase: new URL(siteUrl()),
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
//
// PWA scale lock: maximumScale=1 + userScalable=false. iOS PWA standalone
// mode honors these — pinch-zoom is disabled, and tapping into an input
// no longer auto-zooms the viewport. This is the expected feel for a
// PWA (native apps don't pinch-zoom). The textarea text-base (16px) fix
// in the composer prevents iOS's input auto-zoom on the SAFARI browser
// tab side, where Apple ignores userScalable=no for accessibility.
// Together: PWA = locked; browser tab = inputs sized so no auto-zoom
// fires, but the user can still pinch-zoom for a11y if they need to.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // viewport-fit=cover lets the PWA render edge-to-edge on iOS so the
  // env(safe-area-inset-*) CSS variables become available. We use the
  // bottom inset to keep horizontal-scroll touch targets above the
  // home indicator gesture zone — otherwise iOS's system swipe
  // (which lives just above the bottom edge) intercepts horizontal
  // pans on scrollable rows and the user accidentally exits the PWA.
  viewportFit: "cover",
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
        {/* eslint-disable-next-line react/no-danger -- NO_FLASH_THEME_SCRIPT is a hardcoded module constant with zero user input; an inline pre-paint script is the only way to resolve theme before first render. */}
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
            {/* ELOSTATE Care chat — primary bottom-right affordance.
                Visible on every page. Customer-facing AI first
                responder; agent picks up from /dashboard/care inbox. */}
            <CareChatWidget />
            {/* Floating feedback button — visible on every page per
                the user's directive. Auth-aware: routes to /login on
                public pages, opens the slide-out panel on authed pages.
                Positioned offset so Care widget sits next to it as
                the user requested (Care primary, Feedback secondary). */}
            <FeedbackButton />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
