/**
 * The rules behind the two-page swipe on Today's Metrics (spec §1.1).
 *
 * PURE, AND SEPARATE FROM THE GESTURE, because these are the decisions worth
 * getting right and none of them can be checked by looking at a running app for
 * a few seconds. "Does a 40px flick change the page?" and "does a slow drag at
 * the last page resist?" are questions with exact answers, and a gesture handler
 * is the worst place to keep an exact answer — it can only be exercised by a
 * finger.
 *
 * THE THREE RULES THE SPEC FIXES, and why each exists:
 *
 *   AXIS LOCK. The pager and the page's own vertical scroll both want the
 *   finger. Whichever direction dominates in the first few pixels owns the
 *   gesture for its whole life. Without the lock, a rep scrolling a long list
 *   with a slightly diagonal thumb drags the page sideways under their reading;
 *   with the lock decided ONCE, a gesture cannot change its mind halfway and
 *   leave the track stranded between two pages.
 *
 *   RUBBER BAND. Dragging past the first or last page resists rather than
 *   stops dead. A hard wall reads as a frozen app; resistance reads as an edge,
 *   which is the truth.
 *
 *   SNAP. Release commits to the next page only past a real threshold — a
 *   proportion of the width OR an absolute floor, whichever is smaller. The
 *   proportion is what makes it feel the same on a small phone and a tablet;
 *   the floor is what stops a 22%-of-a-narrow-screen threshold becoming so
 *   small that a resting thumb changes the page.
 */

/** Spec §1.1: the drag is claimed once it has moved this far. */
export const AXIS_LOCK_PX = 8;
/** Spec §1.1: past an end, the finger moves the track by this fraction. */
export const RUBBER_BAND = 0.35;
/** Spec §1.1: a release past this share of the width commits. */
export const SNAP_FRACTION = 0.22;
/** Spec §1.1: …or past this many points, whichever asks less of the finger. */
export const SNAP_MIN_PX = 50;

export type Axis = 'horizontal' | 'vertical' | 'undecided';

/**
 * Which gesture this is, from the movement so far.
 *
 * `undecided` until it has moved `AXIS_LOCK_PX` in SOME direction — deciding on
 * the first pixel would make every tap a horizontal drag, because a finger
 * never lands perfectly still. A tie goes to vertical: the page's own scroll is
 * the more common intent and the more expensive one to steal.
 */
export function axisOf(dx: number, dy: number, lockPx: number = AXIS_LOCK_PX): Axis {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < lockPx) return 'undecided';
  return ax > ay ? 'horizontal' : 'vertical';
}

/**
 * How far the track has actually moved, given the finger's travel.
 *
 * Movement toward a real neighbouring page is 1:1 — anything else feels like
 * lag. Movement past an end is damped, so the edge announces itself without the
 * app appearing to have stopped responding.
 */
export function trackOffset(
  dx: number,
  index: number,
  pageCount: number,
  rubberBand: number = RUBBER_BAND,
): number {
  const pullingPastStart = index === 0 && dx > 0;
  const pullingPastEnd = index === pageCount - 1 && dx < 0;
  return pullingPastStart || pullingPastEnd ? dx * rubberBand : dx;
}

/**
 * The page to settle on when the finger lifts.
 *
 * Never leaves the current page when there is nowhere to go: at index 0 a
 * rightward flick returns 0 rather than -1, because the clamp belongs with the
 * decision, not scattered across every caller.
 */
export function snapTarget(
  dx: number,
  index: number,
  pageCount: number,
  width: number,
  opts: { fraction?: number; minPx?: number } = {},
): number {
  const fraction = opts.fraction ?? SNAP_FRACTION;
  const minPx = opts.minPx ?? SNAP_MIN_PX;
  // The gentler of the two: a wide screen should not demand a longer drag than
  // the absolute floor, and a narrow one should not accept a twitch.
  const threshold = Math.min(width * fraction, minPx);
  if (Math.abs(dx) < threshold) return index;
  const next = dx < 0 ? index + 1 : index - 1;
  return Math.max(0, Math.min(pageCount - 1, next));
}

/**
 * Where the track sits at rest for a given page, in points.
 *
 * Negative because the track moves LEFT to reveal a later page. One expression,
 * so a screen never renders page 2 by translating the wrong way.
 */
export function restingOffset(index: number, width: number): number {
  // `-0 * width` is `-0`, which is equal to 0 for arithmetic but not identical
  // to it — enough to make an exact assertion fail and, more to the point, to
  // leave a negative zero sitting in a style value for no reason.
  return index === 0 ? 0 : -index * width;
}
