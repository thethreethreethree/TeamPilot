import { MeetingReview } from "@/components/sales-coach/MeetingReview";
import { getSession } from "@/lib/data/salesCoach";

/**
 * Post-meeting review page (Phase 6). The component fetches (and, on first view, generates) the dissect from the
 * durable audio. Auth/company come from the dashboard layout; the route itself owner-gates the session.
 *
 * We resolve the session's title + date here (server-side, RLS-scoped) so the "Export PDF" the founder shares with
 * their team carries the meeting's name + date in its header. Best-effort — the review still renders without them.
 */
export default async function MeetingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id).catch(() => null);
  return (
    <MeetingReview
      sessionId={id}
      meetingTitle={session?.clientLabel ?? null}
      meetingStartedAt={session?.startedAt ?? null}
    />
  );
}
