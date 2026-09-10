/**
 * Counting what is still on this phone, in a way that can say "I do not know".
 *
 * WHY THIS EXISTS, and it was found by breaking a test rather than by reading.
 * Every on-device store swallows its own read failure and returns an empty list
 * — `knock-store`'s `readAll` ends `catch { return [] }`, and the other three do
 * the same. That is right for a LIST screen: a rep who cannot read their doors
 * should see an empty list and a caveat, not a crash.
 *
 * It is wrong for the sign-out warning. That message speaks only when a count is
 * above zero, so a failed read does not soften the warning, it DELETES it — and
 * the rep is told nothing is waiting at the exact moment the module exists to
 * tell them otherwise. On a shared phone that is the moment that matters most.
 *
 * A first attempt at this put `.catch(() => null)` around the store calls. It
 * changed nothing, because the stores never reject; the catch guarded a failure
 * that cannot happen. The honest fix has to reach the storage read itself, which
 * is what this does.
 *
 * SCOPED DELIBERATELY NARROW. This is used by the sign-out path and nothing else.
 * Changing every store to return null would ripple into the doors screen, the
 * recordings list and the home outbox line — screens that are correct as they
 * are, and that nobody has yet run on a device.
 *
 * PURE OF NATIVE IMPORTS: it takes the reader as an argument, so the rule is
 * testable and the AsyncStorage call stays in the caller.
 */

/** A count, or null when the store could not be read. Never both as zero. */
export type StrandedCount = number | null;

/**
 * How many entries a stored JSON array holds, or null when it cannot be read.
 *
 * A MISSING KEY IS ZERO, NOT UNKNOWN. A rep who has never logged a door has no
 * key, and telling them "we could not check" would be a false alarm on the
 * commonest case of all. Absence of a key is a real, knowable emptiness; a
 * throw, or content that is not an array, is not.
 */
export async function countStored(
  read: (key: string) => Promise<string | null>,
  key: string,
): Promise<StrandedCount> {
  let raw: string | null;
  try {
    raw = await read(key);
  } catch {
    return null;
  }
  if (raw === null || raw === undefined) return 0;
  try {
    const parsed = JSON.parse(raw);
    // Parsed but not a list: the key holds something this app did not write, so
    // what is stranded is genuinely unknown rather than nothing.
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

/**
 * How many keys carry a prefix, or null when the key list cannot be read.
 *
 * The drafts store keys one entry per topic rather than one array, so it is
 * counted by prefix instead.
 */
export async function countKeysWithPrefix(
  allKeys: () => Promise<readonly string[]>,
  prefix: string,
): Promise<StrandedCount> {
  try {
    const keys = await allKeys();
    return keys.filter((k) => k.startsWith(prefix)).length;
  } catch {
    return null;
  }
}
