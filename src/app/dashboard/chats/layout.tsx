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
