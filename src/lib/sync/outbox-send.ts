/**
 * Turning one queued instruction into one request.
 *
 * SEPARATE FROM THE QUEUE ON PURPOSE. outbox.ts decides what to send and in what
 * order; outbox-classify.ts decides what a given failure MEANS; this is the thin
 * layer between them that actually makes the call. Keeping the three apart is
 * what lets the ordering, replacement and give-up rules — and the whole status
 * classification — be tested without a network.
 *
 * IT REPRODUCES THE SCREEN'S REQUEST EXACTLY. The bodies here must match what
 * the session screen sends when it is online, because a rep must not get one
 * result on signal and a different one off it. In particular `dealValue` is sent
 * only when it was given: absent means "leave the stored value alone" and null
 * means "clear it", which are different instructions to the server, and the
 * queue carries the distinction precisely so it can be reproduced here.
 */
import { coachPatch, coachPost } from '@/lib/coach-api';
import { classify, type SendOutcome } from './outbox-classify';
import type { OutboxEntry } from './outbox';

export async function sendOutboxEntry(entry: OutboxEntry): Promise<SendOutcome> {
  try {
    if (entry.kind === 'rename') {
      const clientLabel = entry.clientLabel?.trim();
      if (!clientLabel) {
        // An empty name is not something the server will ever accept, and
        // retrying it forever would keep a permanently unsendable entry at the
        // front of the queue. Rejected, with a reason a person can read.
        return { ok: false, reason: 'rejected', message: 'A call needs a name.' };
      }
      await coachPatch(`/api/coach/sales-session/${entry.sessionId}`, { clientLabel });
      return { ok: true };
    }

    if (!entry.outcome) {
      return { ok: false, reason: 'rejected', message: 'No outcome was recorded.' };
    }
    await coachPost(`/api/coach/sales-session/${entry.sessionId}/outcome`, {
      outcome: entry.outcome,
      ...(entry.dealValue !== undefined ? { dealValue: entry.dealValue } : {}),
    });
    return { ok: true };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    const message = e instanceof Error && e.message ? e.message : undefined;
    return classify(status, message);
  }
}
