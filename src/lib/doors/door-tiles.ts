import { count } from '@/lib/format';
/**
 * The three door counts on the macro home.
 *
 * THE BUG THIS REPLACES was `waiting.total + (totals?.doorsKnocked ?? 0)`. It is
 * the fourth instance in this app of the same shape, and the most damaging:
 *
 *   A rep knocks forty doors. Every one reaches the server. Next morning they
 *   open the app in a basement with no signal, the totals fetch fails, and the
 *   tile reads "0 DOORS TODAY".
 *
 * Which is not a rounding error — it is the app telling somebody their work did
 * not happen. And it is indistinguishable from a genuine zero, so there is no
 * way for them to know which one they are looking at.
 *
 * WHAT IT DOES INSTEAD. The phone always knows exactly what it is holding, and
 * that part is never in doubt. What it may not know is the server's half. So:
 *
 *   server known                  → the sum, plainly.
 *   server unknown, phone has some → the phone's count, marked AT LEAST, because
 *                                    that is exactly what is true.
 *   server unknown, phone has none → an em dash. Nothing is known, and "0" would
 *                                    be a claim rather than an absence.
 *
 * "At least 6" is a strange thing to put on a tile and it is the right thing.
 * A rep can act on it: they know six are theirs from this morning, and they know
 * the rest has not been counted yet.
 */

export type DoorTile = {
  key: string;
  /** Already a string, so an em dash is a legal value rather than a lie. */
  value: string;
  label: string;
  /** True when the value is a floor, not a total. */
  partial: boolean;
  emphasis?: boolean;
  spoken: string;
};

export type DoorTilesInput = {
  /** What this phone is holding for today. Always known exactly. */
  waiting: { total: number; sold: number; goBack: number };
  /** The server's totals for today, or null when they could not be read. */
  totals: { doorsKnocked: number; sold: number; goBacks: number } | null;
};

function tile(
  key: string,
  label: string,
  local: number,
  server: number | undefined,
  known: boolean,
  emphasise = false,
): DoorTile {
  if (known) {
    const total = local + (server ?? 0);
    return {
      key,
      // Grouped, not `String(n)`. An all-time figure passes a thousand for any
      // working rep — 50 doors a day is 12,500 a year — and "12500" beside the
      // Arena's "12,500" is the same number written two ways, two taps apart.
      value: count(total),
      label,
      partial: false,
      emphasis: emphasise && total > 0,
      spoken: `${total} ${label.toLowerCase()}`,
    };
  }
  if (local > 0) {
    return {
      key,
      value: count(local),
      label,
      partial: true,
      // Never emphasised while partial: outlining a floor draws the eye to a
      // number that is not the answer.
      emphasis: false,
      spoken: `at least ${local} ${label.toLowerCase()}, the rest could not be counted`,
    };
  }
  return {
    key,
    value: '—',
    label,
    partial: true,
    emphasis: false,
    spoken: `${label.toLowerCase()} could not be counted`,
  };
}

export function buildDoorTiles(input: DoorTilesInput): {
  tiles: DoorTile[];
  /** True when any tile is a floor rather than a total — the screen says so once. */
  anyPartial: boolean;
} {
  const known = input.totals !== null;
  const tiles = [
    tile('doors', 'Doors knocked', input.waiting.total, input.totals?.doorsKnocked, known),
    tile('goBacks', 'Go backs', input.waiting.goBack, input.totals?.goBacks, known),
    tile('sold', 'Sold', input.waiting.sold, input.totals?.sold, known, true),
  ];
  return { tiles, anyPartial: tiles.some((t) => t.partial) };
}
