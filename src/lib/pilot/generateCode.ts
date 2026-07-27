/**
 * Canonical definition of a pilot access code — the single source of truth for
 * how codes are SHAPED and GENERATED.
 *
 * Why this file exists (§1.1 Data-as-Asset): the original 100 pilot codes were
 * produced by a one-off, uncommitted script. That made the generation method a
 * *discarded asset* — typo-safety held only by luck of a script nobody could
 * re-run, and a future batch could silently reintroduce look-alike characters.
 * This module puts the method on the record and makes typo-safety a
 * BY-CONSTRUCTION guarantee (the alphabet simply has no ambiguous glyphs), not
 * a property to be re-verified each time.
 *
 * Pure + injectable randomness so it's unit-testable and so callers can supply a
 * crypto-secure source (the CLI does; see scripts/pilot-generate.mjs).
 */

/**
 * The unambiguous alphabet: A–Z and 2–9 with the look-alike glyphs removed —
 *   0/O, 1/I/L.
 * A human hand-typing a code off a PDF cannot confuse two characters here, which
 * is the whole point (clients type these; a misread is real support cost).
 *
 * 31 symbols. DO NOT add 0, O, 1, I, or L — the guard test asserts their
 * absence, and re-introducing one reopens the typo-confusion class.
 */
export const PILOT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Codes are exactly this many characters (founder spec: "7 alphanumeric"). */
export const PILOT_CODE_LENGTH = 7;

/**
 * A code is well-formed iff it is exactly PILOT_CODE_LENGTH characters, every one
 * drawn from PILOT_CODE_ALPHABET. This is the same predicate the generator
 * satisfies by construction — so it doubles as a validator for input coming back
 * the other way (a cheap format check before any DB round-trip).
 */
export function isValidPilotCodeShape(code: string): boolean {
  if (typeof code !== "string" || code.length !== PILOT_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!PILOT_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/**
 * Generate one code. `randomInt(maxExclusive)` must return a uniformly-random
 * integer in [0, maxExclusive) — inject crypto.randomInt in production for an
 * unbiased, cryptographically-secure draw; a seeded stub in tests.
 *
 * We index the alphabet rather than mapping raw bytes with `% length`, so there
 * is no modulo bias (31 does not divide 256): each glyph is equally likely.
 */
export function generatePilotCode(randomInt: (maxExclusive: number) => number): string {
  let out = "";
  for (let i = 0; i < PILOT_CODE_LENGTH; i++) {
    out += PILOT_CODE_ALPHABET[randomInt(PILOT_CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Generate `count` DISTINCT codes. Rejects collisions within the batch (and
 * against `existing`, e.g. codes already in the DB) so a batch never ships a
 * duplicate — the DB's UNIQUE constraint is the backstop, this is the guard that
 * keeps us from wasting a redemption slot on a dupe insert.
 *
 * With a 31^7 (~27.5 billion) space and pilot-scale batches, collisions are
 * astronomically rare; the loop is correctness insurance, not a hot path. The
 * safety cap prevents an infinite loop if a caller ever asks for more distinct
 * codes than the space can hold.
 */
export function generateDistinctPilotCodes(
  count: number,
  randomInt: (maxExclusive: number) => number,
  existing: Iterable<string> = [],
): string[] {
  const seen = new Set(existing);
  const out: string[] = [];
  const maxAttempts = count * 50 + 100; // generous; collisions are near-impossible at pilot scale
  let attempts = 0;
  while (out.length < count) {
    if (attempts++ > maxAttempts) {
      throw new Error(
        `Could not generate ${count} distinct pilot codes after ${attempts} attempts — ` +
          `the alphabet/length space may be exhausted relative to the requested count.`,
      );
    }
    const code = generatePilotCode(randomInt);
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}
