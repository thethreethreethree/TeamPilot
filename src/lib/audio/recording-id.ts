/**
 * A recording's client id.
 *
 * Generated once per recording and NEVER regenerated, so a retried upload is
 * recognisably the same call rather than a second copy of it. That makes this
 * the value the whole de-duplication story rests on: two recordings that collide
 * are merged into one, and a retry that does not match is banked twice.
 *
 * Not `crypto.randomUUID` — it is not present on every React Native runtime this
 * app targets, and a capture path is the wrong place to discover that. Time plus
 * randomness is sufficient here: the value only has to be unique among one rep's
 * unsent recordings on one device.
 *
 * SPLIT OUT OF `capture.ts` so it can be tested. `capture.ts` imports
 * `expo-audio` and `expo-file-system`, which put the id generator behind a
 * native module — so the one property that matters, that two recordings started
 * in the same millisecond still differ, could not be checked off a device.
 * `capture.ts` re-exports this, so existing importers are unaffected.
 */

/** `rec_<base36 millis>_<8 random base36 chars>`. */
export function newClientId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `rec_${Date.now().toString(36)}_${rand}`;
}
