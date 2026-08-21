import { MeetingReview } from "@/components/sales-coach/MeetingReview";

/**
 * Post-meeting review page (Phase 6). The component fetches (and, on first view, generates) the dissect from the
 * durable audio. Auth/company come from the dashboard layout; the route itself owner-gates the session.
 */
export default async function MeetingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingReview sessionId={id} />;
}
