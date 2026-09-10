/**
 * A manager's alerts (spec 5.3) — strong sessions and closed deals.
 *
 * READ HERE, MARKED READ ON THE SERVER. `manager_notifications` has a SELECT
 * policy scoped to `recipient_id = auth.uid()` and NO client write policy, by
 * design. So the phone can list them directly under RLS, and mark-read must go
 * through the route (§4: "You cannot mark-read directly").
 *
 * RENDERED FROM `payload`, NEVER A JOIN. The column exists precisely so an alert
 * can be drawn without reaching back for the agent or the session — which also
 * means a notification about a rep who has since left still renders rather than
 * collapsing to a blank row.
 *
 * AN UNKNOWN TYPE IS SHOWN, NOT SWALLOWED. The web may add a notification type
 * before the phone knows about it; dropping those would silently hide a
 * manager's alerts. An unrecognised one renders with what it has.
 */

import { authFailureMessage, type AuthFailure } from '@/lib/auth-failure';

export type NotificationType = 'strong_session' | 'deal_closed';

export type ManagerNotification = {
  id: string;
  agentId: string | null;
  sessionId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

export function isUnread(n: ManagerNotification): boolean {
  return !n.readAt;
}

export function unreadCount(rows: ManagerNotification[]): number {
  return rows.filter(isUnread).length;
}

/**
 * The line a manager reads.
 *
 * Everything comes from `payload`. A name that is not there is not invented —
 * "A rep" is honest, and a made-up name on an alert about somebody's
 * performance would be worse than no name at all.
 */
export function notificationLine(n: ManagerNotification): { title: string; detail: string } {
  const name = str(n.payload.agent_name) || str(n.payload.full_name) || 'A rep';
  const points = numOrNull(n.payload.points);

  if (n.type === 'strong_session') {
    return {
      title: `${name} had a strong call`,
      detail: points === null ? 'Scored above the strong threshold.' : `Scored ${points} out of 100.`,
    };
  }
  if (n.type === 'deal_closed') {
    return { title: `${name} closed a deal`, detail: 'Marked sold on a recorded call.' };
  }
  // Unknown to this build of the app. Say so plainly rather than hide it.
  return {
    title: `${name} — new activity`,
    detail: 'This alert is newer than the app. Open it on the website to see it in full.',
  };
}

function str(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Mark specific alerts read locally, so the badge clears the moment the server
 * confirms rather than after a refetch.
 *
 * AN ALREADY-READ ROW KEEPS ITS ORIGINAL TIMESTAMP. Overwriting it would move a
 * manager's "you read this on Tuesday" to today, which is a quiet lie about
 * their own history — and the server does the same, updating only rows whose
 * `read_at` is null.
 *
 * Returns the same array reference when nothing changed, so a screen holding it
 * in state does not re-render for a no-op.
 */
export function markReadLocally(
  rows: ManagerNotification[],
  ids: readonly string[],
  atIso: string,
): ManagerNotification[] {
  const wanted = new Set(ids);
  let changed = false;
  const next = rows.map((n) => {
    if (!wanted.has(n.id) || n.readAt) return n;
    changed = true;
    return { ...n, readAt: atIso };
  });
  return changed ? next : rows;
}

/**
 * What to tell a manager when marking read did not save.
 *
 * PURE, and separate from the request, because the wording is the part worth
 * pinning: this function's predecessor answered every 401, 403 and 404 with
 * "needs a change on the website that has not gone live yet" — a cause the app
 * cannot know, and one that became false the moment the route accepted a Bearer
 * token. A manager whose session had merely expired was told to wait for a
 * deploy that would never fix it.
 *
 * `why` is the verdict `coach-api` already computed for a 401, AFTER its one
 * refresh: 'signed-out' or 'route'. It is consumed, never re-derived — deriving
 * it again from the status code alone is exactly how the old message came back.
 */
export function markReadFailureMessage(status: number | undefined, why: AuthFailure | null): string {
  if (status === 401) return authFailureMessage(why ?? 'route');
  // Only a manager has notifications at all, so a 403 means the account is not one.
  if (status === 403) return 'Your account cannot change these alerts. The alerts themselves are up to date.';
  return 'That did not save. Your alerts are unchanged — try again when you have signal.';
}
