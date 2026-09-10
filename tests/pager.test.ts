/**
 * The two-page swipe on Today's Metrics (spec §1.1).
 *
 * These are exact rules with exact answers, and none of them can be verified by waving a thumb at a running app.
 * The one that matters most is the axis lock: get it wrong and a rep scrolling a long list with a slightly
 * diagonal thumb drags the page sideways under their reading.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AXIS_LOCK_PX,
  RUBBER_BAND,
  axisOf,
  restingOffset,
  snapTarget,
  trackOffset,
} from '@/lib/pager';

const W = 390; // a narrow phone, where the thresholds are tightest

test('a gesture is undecided until it has actually moved', () => {
  // Deciding on the first pixel would make every tap a horizontal drag: a finger never lands perfectly still.
  assert.equal(axisOf(0, 0), 'undecided');
  assert.equal(axisOf(3, 2), 'undecided');
  assert.equal(axisOf(AXIS_LOCK_PX - 1, 0), 'undecided');
});

test('the dominant direction claims the gesture once the lock distance is passed', () => {
  assert.equal(axisOf(AXIS_LOCK_PX, 1), 'horizontal');
  assert.equal(axisOf(1, AXIS_LOCK_PX), 'vertical');
  assert.equal(axisOf(-40, 5), 'horizontal');
  assert.equal(axisOf(5, -40), 'vertical');
});

test('a diagonal tie goes to VERTICAL — the page keeps its own scroll', () => {
  // The more common intent and the more expensive one to steal. A rep reading a long list must not have it
  // yanked sideways because their thumb travelled equally in both directions.
  assert.equal(axisOf(20, 20), 'vertical');
  assert.equal(axisOf(-20, 20), 'vertical');
});

test('the track follows the finger exactly between real pages', () => {
  // Anything less than 1:1 reads as lag.
  assert.equal(trackOffset(-60, 0, 2), -60);
  assert.equal(trackOffset(60, 1, 2), 60);
});

test('dragging past an end resists instead of stopping dead', () => {
  // A hard wall reads as a frozen app; resistance reads as an edge, which is the truth.
  assert.equal(trackOffset(100, 0, 2), 100 * RUBBER_BAND);
  assert.equal(trackOffset(-100, 1, 2), -100 * RUBBER_BAND);
  assert.ok(Math.abs(trackOffset(100, 0, 2)) < 100, 'the edge must resist');
  assert.notEqual(trackOffset(100, 0, 2), 0, 'but it must still move — a dead edge looks broken');
});

test('a small drag snaps back to the page it started on', () => {
  assert.equal(snapTarget(-20, 0, 2, W), 0);
  assert.equal(snapTarget(20, 1, 2, W), 1);
});

test('a drag past the threshold commits to the neighbour', () => {
  assert.equal(snapTarget(-120, 0, 2, W), 1);
  assert.equal(snapTarget(120, 1, 2, W), 0);
});

test('the threshold is the GENTLER of the fraction and the floor', () => {
  // On a wide screen 22% would demand a longer drag than the 50px floor, so the floor wins; on a narrow one the
  // fraction is smaller and it wins. Taking the max instead would make a tablet feel stiff.
  const wide = 1200;
  assert.equal(snapTarget(-60, 0, 2, wide), 1, '60px past the 50px floor must commit even on a wide screen');
  const narrow = 200; // 22% = 44px, below the floor
  assert.equal(snapTarget(-45, 0, 2, narrow), 1);
  assert.equal(snapTarget(-40, 0, 2, narrow), 0);
});

test('there is nowhere to go past either end, and the clamp lives with the decision', () => {
  assert.equal(snapTarget(300, 0, 2, W), 0, 'flicking right on the first page must not reach -1');
  assert.equal(snapTarget(-300, 1, 2, W), 1, 'flicking left on the last page must not run off the end');
});

test('the track moves LEFT to reveal a later page', () => {
  // One expression for this, so no screen renders page 2 by translating the wrong way.
  assert.equal(restingOffset(0, W), 0);
  assert.equal(restingOffset(1, W), -W);
  assert.ok(restingOffset(1, W) < 0);
});
