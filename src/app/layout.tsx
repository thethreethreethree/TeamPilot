import type { Metadata, Viewport } from "next";
import "./globals.css";

const TITLE = "ExecOS — An honest AI executive operating system";
const DESCRIPTION =
  "An AI that refuses to give you an answer it hasn't earned. ExecOS stays silent until it has real evidence, asks for your read before it speaks, and learns only from outcomes that actually held.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s · ExecOS",
  },
  description: DESCRIPTION,
  applicationName: "ExecOS",
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
    siteName: "ExecOS",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0d16",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0c0d16] text-[#e8eaf6] antialiased">
        {children}
      </body>
    </html>
  );
}
