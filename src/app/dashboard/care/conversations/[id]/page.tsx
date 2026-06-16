import { ConversationsApp } from "@/components/care/ConversationsApp";

export default async function CareConversationDeepLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConversationsApp initialId={id} />;
}
