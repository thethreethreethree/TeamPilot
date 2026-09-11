/**
 * What a queued change is called, in words — written ONCE.
 *
 * WHY IT LEFT THE SCREEN. The session screen built this sentence inline, and then needed the same
 * sentence a second time to say what had just been discarded. Two copies of "how a queued change
 * describes itself" is the duplicated-rule failure this project has already paid for: a band
 * threshold written twice told one rep "Elite" on one screen and "Strong" on another. A discard
 * message that disagreed with the row it removed would be the same fault, in the one moment a rep
 * is checking whether the app did what they meant.
 *
 * PURE, so both sentences can be read side by side in a test. `format.ts` owns how a value becomes
 * human text; this owns how a PENDING CHANGE describes itself.
 */
import { money, outcomeLabel } from '@/lib/format';
import type { OutboxEntry } from '@/lib/sync/outbox';

/**
 * The row in "Waiting to send".
 *
 * Phrased as the change it will MAKE rather than as a record type — "Mark it sold" is what the rep
 * asked for, "outcome: sold" is what the database calls it.
 */
export function queuedEntryLabel(entry: OutboxEntry): string {
  if (entry.kind === 'rename') return `Name it “${entry.clientLabel ?? ''}”`;
  const value = entry.dealValue != null ? ` · ${money(entry.dealValue)}` : '';
  return `Mark it ${outcomeLabel(entry.outcome ?? null)}${value}`;
}

/**
 * What the screen says after a discard, and why it says anything at all.
 *
 * DISCARD USED TO BE SILENT. It removed the row and said nothing — no confirmation step before, no
 * word after. For a sighted rep the row vanishing is at least a signal; for anyone using a screen
 * reader the list simply became shorter, with nothing announcing that the thing they had typed
 * offline was gone. This app confirms both of its other destructive actions: deleting a recording
 * asks first and names what will be lost, and clearing the crash log answers "The list is now
 * empty". This one answered nothing.
 *
 * IT NAMES WHAT WENT, not just that something did. "Discarded" alone leaves a rep who mis-tapped
 * unable to tell WHICH pending change they just dropped when two are queued.
 *
 * AND IT SAYS WHAT DID NOT HAPPEN. Discarding an unsent change is not undoing anything on the
 * server — the call keeps whatever is already stored against it. A rep who discards a queued
 * "Sold" could otherwise reasonably believe they had just un-sold the call.
 */
export function discardedMessage(entry: OutboxEntry): string {
  const what =
    entry.kind === 'rename'
      ? `the new name you had waiting — ${queuedEntryLabel(entry)}`
      : `the change you had waiting — ${queuedEntryLabel(entry)}`;
  return `Discarded ${what}. It will not be sent. Nothing already saved against this call changed.`;
}
