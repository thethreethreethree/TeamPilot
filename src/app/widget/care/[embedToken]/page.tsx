import { CareEmbeddedWidget } from "@/components/care/CareEmbeddedWidget";

/**
 * /widget/care/[embedToken]
 *
 * The iframe-hosted widget page. Third-party sites embed this
 * page via the care-widget.js snippet. Inside the iframe we
 * render the chat panel theme'd per tenant.
 *
 * No auth on this surface — the embed token + origin
 * validation is enforced at the conversation API layer. Anyone
 * who can render this page can see the widget shell; only valid
 * (token, origin) pairs can actually open conversations.
 */

export const dynamic = "force-dynamic";

export default async function CareWidgetIframePage({
  params,
}: {
  params: Promise<{ embedToken: string }>;
}) {
  const { embedToken } = await params;
  return <CareEmbeddedWidget embedToken={embedToken} />;
}
