import { Suspense } from "react";
import ChatsPage from "@/app/dashboard/chats/page";

/**
 * Sales Coach → Team Chat.
 *
 * Surfaces the EXISTING Elostate team chat INSIDE the Sales Coach shell by
 * reusing its list component (§A21 — one chat system, not a second one).
 *
 * Deliberate boundary (flagged in the build report): opening a topic
 * navigates to the existing /dashboard/chats/[id], which leaves this shell
 * — I am NOT forking the chat detail route into the sales-coach tree, since
 * that would duplicate the whole subsystem. So: the list lives in-shell, the
 * topic detail is the existing chat.
 *
 * Suspense wraps it because the reused chat list reads useSearchParams.
 */
export default function SalesCoachTeamChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatsPage />
    </Suspense>
  );
}
