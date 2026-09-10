/**
 * The digits of the running total, as an odometer shows them.
 *
 * SPEC §2 asks for "grouped digits, e.g. `5 4 8`" and the app was rendering a
 * plain number. The web puts each digit in its own raised tile with the comma as
 * a narrow separator between them, and the owner's standing rule is that the two
 * look the same — this was the one Arena element that visibly did not.
 *
 * PURE, because "what characters, in what order, and which of them are
 * separators" is a rule, and the screen's job is only to draw the boxes. It also
 * means the awkward inputs can be tested: a total is a number that arrives from
 * a server, so it can be negative, fractional, or not a number at all.
 */

export type OdoChar =
  /** A digit, or a minus sign — gets its own tile. */
  | { kind: 'digit'; char: string }
  /** A thousands separator — drawn narrow, with no tile behind it. */
  | { kind: 'separator'; char: string };

/**
 * Split a total into the characters an odometer draws.
 *
 * ROUNDED, and grouped with the same `toLocaleString('en-US')` the rest of the
 * app formats counts with, so 1234 reads "1,234" here exactly as it does
 * everywhere else. A second grouping rule would be a second answer to the same
 * question.
 *
 * A NON-FINITE TOTAL GIVES A SINGLE ZERO rather than "NaN" spelled out in three
 * tiles. That is the one place this differs from the rest of the app's
 * unknown-is-never-a-zero rule, and deliberately: the caller only reaches this
 * function on the success path, where `total` is a real sum — the Arena's error
 * and empty states are handled long before the odometer renders.
 */
export function odometerChars(total: number): OdoChar[] {
  if (!Number.isFinite(total)) return [{ kind: 'digit', char: '0' }];
  return [...Math.round(total).toLocaleString('en-US')].map((char) =>
    char === ',' ? { kind: 'separator', char } : { kind: 'digit', char },
  );
}
