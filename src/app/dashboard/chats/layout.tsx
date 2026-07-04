import type { Metadata } from "next";
import { TeamChatServiceWorkerRegister } from "@/components/pwa/TeamChatServiceWorkerRegister";

/**
 * Team Chat PWA shell — overrides the root manifest for /dashboard/chats/*
 * routes so users on the chat surface get a focused "Install Team Chat"
 * prompt instead of the full "Install ELOSTATE" prompt.
 *
 * Spec: Team Chat PWA Phase 1 (Installable Shell).
 *
 * How browsers handle this:
 *   - When the user is on /dashboard/chats (or any sub-route), the
 *     browser sees the team-chat-manifest.webmanifest link tag (Next.js
 *     emits it from the metadata.manifest field below).
 *   - The browser's install prompt uses this focused manifest:
 *     name "ELOSTATE Team Chat", start_url /dashboard/chats,
 *     scope /dashboard/chats/.
 *   - Installed PWA opens directly to the chat list, fullscreen.
 *   - Navigation to other dashboard sections (settings, team, etc.)
 *     leaves the PWA scope — handled by the browser normally.
 *
 * The root manifest at src/app/manifest.ts is still the default for
 * every other page, so the full "Install ELOSTATE" install path still
 * works from /dashboard, /dashboard/team, etc.
 */
export const metadata: Metadata = {
  manifest: "/team-chat-manifest.webmanifest",
  // iOS Safari uses these meta tags rather than the manifest fields
  // for its "Add to Home Screen" install behavior. Set them
  // explicitly so the installed Team Chat PWA on iPhone/iPad gets:
  //   - Standalone display (no Safari UI when launched)
  //   - "Team Chat" label under the home-screen icon
  //   - Status bar styled to match the brand's matte black
  //   - The chat-themed icon (vs. the main ELOSTATE icon)
  appleWebApp: {
    capable: true,
    title: "Team Chat",
    // statusBarStyle "default" → iOS renders the status bar ABOVE
    // the app content (the page starts BELOW the clock/battery
    // strip). Was "black-translucent" before, which extends the
    // page behind the status bar for an "immersive" feel — but
    // that mode requires every top-pinned element to manually
    // apply env(safe-area-inset-top) padding to avoid overlap,
    // and PWA caching made the padding flaky in practice. Default
    // is the reliable native-app-feel pattern: iOS handles the
    // safe-area buffer for us, content never sits behind system
    // UI, no padding gymnastics required.
    statusBarStyle: "default",
    startupImage: [
      // Apple touch-startup-image hints — iOS uses these as splash
      // when launching the standalone app. SVG works on iOS 16+;
      // older iOS falls back to a blank theme-colored screen, which
      // is still fine given the manifest background_color matches.
      "/icon-team-chat.svg",
    ],
  },
  other: {
    // Belt-and-suspenders for older iOS that doesn't pick up the
    // appleWebApp fields. These mirror the modern fields but as
    // raw meta tags for maximum compatibility.
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Team Chat",
    // The apple-touch-icon meta tag tells iOS which icon to use when
    // the user adds the page to their home screen. Use PNG — iOS renders
    // PNG reliably on every version, whereas SVG apple-touch-icon support
    // is version-dependent (audit F1). Rendered from the SVG.
    "apple-touch-icon": "/icon-team-chat-apple.png",
  },
};

export default function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TeamChatServiceWorkerRegister />
      {children}
    </>
  );
}
