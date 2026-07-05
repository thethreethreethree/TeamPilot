import { CareEmbeddedWidget } from "@/components/care/CareEmbeddedWidget";
import { LearningHint } from "@/components/learning/LearningHint";

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
  return (
    <LearningHint
      as="block"
      category="C.A.R.E · Widget"
      title="Embedded support widget"
      whatItIs="The chat panel your customers see when C.A.R.E is embedded on your website — running inside an iframe, themed to your brand."
      why="This is the customer-facing entry point to the whole C.A.R.E loop: every conversation that later becomes a signal, pattern, or resolution starts here. It runs token- and origin-scoped so only your authorized sites can open real conversations."
      how="Embed it with the care-widget.js snippet; the embed token in the URL binds it to your tenant. Test from an allowed origin — other origins can render the shell but can't open conversations."
      principle="The support surface is where the learning loop begins, not ends."
    >
      <CareEmbeddedWidget embedToken={embedToken} />
    </LearningHint>
  );
}
