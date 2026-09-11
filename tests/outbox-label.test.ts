/**
 * A DISCARD THAT SAYS NOTHING, AND A SENTENCE WRITTEN TWICE.
 *
 * Two faults, one cause. The session screen built "what this queued change is" inline, and then
 * needed the same words again to say what had just been discarded — so the second copy was about to
 * be written. A band threshold written twice in this codebase once told one rep "Elite" on one
 * screen and "Strong" on another; a discard message that disagreed with the row it removed would be
 * the same fault, in the one moment a rep is checking whether the app did what they meant.
 *
 * The discard itself was silent. It removed the row and said nothing — no confirmation before, no
 * word after. A sighted rep at least sees the row vanish; with a screen reader the list simply got
 * shorter. Both of this app's other destructive actions do better: deleting a recording asks first
 * and names the length, the date and that it is the only copy, and clearing the crash log answers
 * "The list is now empty". This one answered nothing, and it is the one that drops something the
 * rep TYPED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { discardedMessage, queuedEntryLabel } from '@/lib/sync/outbox-label';
import type { OutboxEntry } from '@/lib/sync/outbox';

const base = { id: 'e1', sessionId: 's1', attempts: 0, queuedAt: 0 } as unknown as OutboxEntry;
const rename = { ...base, kind: 'rename', clientLabel: 'Acme Roofing' } as OutboxEntry;
const sold = { ...base, kind: 'outcome', outcome: 'sold', dealValue: 1500 } as OutboxEntry;
const noValue = { ...base, kind: 'outcome', outcome: 'no_sale' } as OutboxEntry;

test('the row says the change it will make, not the record type', () => {
  assert.equal(queuedEntryLabel(rename), 'Name it “Acme Roofing”');
  assert.match(queuedEntryLabel(sold), /^Mark it /);
  assert.match(queuedEntryLabel(sold), /1,500|1500/);
});

test('a deal value that was never set adds nothing', () => {
  // `dealValue` absent means "leave it alone". A trailing separator with nothing after it would
  // read as a value the rep failed to enter.
  const said = queuedEntryLabel(noValue);
  assert.doesNotMatch(said, /·\s*$/);
  assert.doesNotMatch(said, /undefined|null|NaN/);
});

test('the discard message repeats the row word for word', () => {
  /*
    THE WHOLE POINT OF ONE FUNCTION. If these two ever disagree, a rep is told they discarded
    something different from the row that disappeared — and the row is gone, so they cannot check.
  */
  for (const entry of [rename, sold, noValue]) {
    assert.ok(
      discardedMessage(entry).includes(queuedEntryLabel(entry)),
      'the confirmation must quote the row it removed',
    );
  }
});

test('it says what did NOT happen, which is the part a rep can get wrong', () => {
  /*
    Discarding an unsent change does not undo anything on the server; the call keeps whatever is
    already stored against it. A rep who discards a queued "Sold" could otherwise reasonably believe
    they had just un-sold the call — which would be a wrong belief about their own numbers.
  */
  const said = discardedMessage(sold);
  assert.match(said, /will not be sent/i);
  assert.match(said, /Nothing already saved against this call changed/i);
});

test('two queued changes produce two different messages', () => {
  // "Discarded." alone cannot tell a rep WHICH pending change they just dropped.
  assert.notEqual(discardedMessage(rename), discardedMessage(sold));
});
