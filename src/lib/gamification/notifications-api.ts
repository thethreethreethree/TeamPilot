/**
 * Reading a manager's alerts, and marking them read.
 *
 * THE TWO HALVES GO DIFFERENT WAYS, and that is the schema's decision rather
 * than a preference. `manager_notifications` has a SELECT policy scoped to
 * `recipient_id = auth.uid()` and NO client write policy at all, so:
 *
 *   READ   direct via Supabase — live today, no deploy.
 *   MARK   through the coach route, which writes service-role after checking
 *          the caller. There is no client path, and inventing one is not
 *          possible rather than merely discouraged.
 *
 * BOTH HALVES WORK FROM THE PHONE TODAY. This comment used to say the mark-read
 * did not, which was an assumption rather than a reading: the coach route
 * resolves a caller from a mobile Bearer token as well as a web cookie, so the
 * only thing missing was ever a client write policy — and there was never meant
 * to be one. When the mark-read does fail it is almost always an expired
 * session, and the message now says so instead of blaming a deploy.
 */
import { supabase } from '@/lib/supabase';
import { coachPost } from '@/lib/coach-api';
import { type AuthFailure } from '@/lib/auth-failure';

import { markReadFailureMessage, type ManagerNotification } from './notifications';

/**
 * The route's own bound, mirrored exactly.
 *
 * 50, because `/api/coach/gamification/notifications` uses `.limit(50)`. This
 * was 100 — a number I picked — which would have shown a manager more alerts in
 * the app than on the website for the same account, and made the "showing your
 * N most recent" line disagree between the two.
 */
export const NOTIFICATIONS_LIMIT = 50;

export async function fetchNotifications(): Promise<{
  rows: ManagerNotification[];
  failed: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from('manager_notifications')
      .select('id, agent_id, session_id, type, payload, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(NOTIFICATIONS_LIMIT);
    if (error || !data) return { rows: [], failed: true };
    return {
      rows: data.map((r) => ({
        id: String(r.id),
        agentId: (r.agent_id as string | null) ?? null,
        sessionId: (r.session_id as string | null) ?? null,
        type: String(r.type ?? ''),
        payload:
          r.payload && typeof r.payload === 'object'
            ? (r.payload as Record<string, unknown>)
            : {},
        createdAt: (r.created_at as string) ?? '',
        readAt: (r.read_at as string | null) ?? null,
      })),
      failed: false,
    };
  } catch {
    return { rows: [], failed: true };
  }
}

/**
 * Mark alerts read.
 *
 * Returns an error message rather than throwing, because every failure here is
 * something the manager needs to read, and they do not all mean the same thing.
 *
 * THE 401 IS NOT OURS TO INTERPRET. This function used to answer every 401, 403
 * and 404 with "needs a change on the website that has not gone live yet" — a
 * cause it could not possibly know, and one that stopped being true the moment
 * the route accepted a Bearer token. A manager whose session had simply expired
 * was told to wait for a deploy that would never fix it.
 *
 * `coach-api` already refreshes once and then classifies the 401 as `signed-out`
 * or `route`, and hands that verdict down on the error. Consuming that verdict —
 * rather than re-deriving one from the status code — is the whole point of it
 * being computed in one place.
 */
export async function markNotificationsRead(
  what: { all: true } | { ids: string[] },
): Promise<string | null> {
  try {
    await coachPost('/api/coach/gamification/notifications', what);
    return null;
  } catch (e) {
    return markReadFailureMessage(
      (e as { status?: number })?.status,
      (e as { authFailure?: AuthFailure | null })?.authFailure ?? null,
    );
  }
}

/**
 * Live alerts for ONE manager (spec §6).
 *
 * THIS ONE GENUINELY FIRES, unlike the session subscriptions elsewhere in this
 * app — and that difference was checked rather than assumed. `subscribeMySessions`
 * carries a warning that no migration adds `coaching_sessions` to the
 * `supabase_realtime` publication, so it connects and never delivers. Here,
 * migration `0245_manager_notifications_realtime.sql` adds
 * `manager_notifications` to that publication explicitly. I opened it.
 *
 * THE FILTER IS SERVER-SIDE, and doing it here rather than in the handler is
 * not an optimisation for its own sake: without it a manager's phone is woken
 * for every alert in the company. RLS would refuse to hand over the rows, so
 * nothing leaks either way — but being told about them costs a metered
 * connection and a wake-up per event, which on a phone is a real cost paid for
 * nothing.
 *
 * IT DELIVERS A NUDGE, NOT DATA. The handler re-fetches rather than appending
 * the payload it was sent, because the unread COUNT has to stay authoritative:
 * an alert marked read on the website, or one that arrived while the socket was
 * down, would make a locally-appended list quietly wrong. A re-fetch is one
 * request and cannot drift.
 *
 * REALTIME IS AN ENHANCEMENT, NEVER THE BASELINE. Sockets drop on a phone that
 * changes cell or sleeps in a pocket. The screen keeps its own poll, and this
 * only makes the gap between polls shorter.
 */
export function subscribeManagerNotifications(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`manager-notifs:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'manager_notifications',
        filter: `recipient_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
